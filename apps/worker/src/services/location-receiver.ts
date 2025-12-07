import { query } from "../config/db.js";
import { coordsToPointWKT, wrapWKTToGeomFromText } from "../utils/geo.utils.js";
import { Coordinates } from "../shared/geo.types.js";
import { OrderStatus } from "../types/order.types.js";
import { WebSocketManager } from "./websocket-manager.js";

/**
 * 位置接收服务
 * 接收来自 mock 物流端的位置推送，更新数据库并通过 WebSocket 推送给前端
 */
export class LocationReceiver {
  private websocketManager: WebSocketManager;

  constructor(websocketManager: WebSocketManager) {
    this.websocketManager = websocketManager;
  }

  /**
   * 接收位置更新
   * @param orderId 订单ID
   * @param coords 位置坐标
   * @param merchantId 商家ID（可选，用于验证）
   */
  async receiveLocationUpdate(
    orderId: string,
    coords: Coordinates,
    merchantId?: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      // 验证订单是否存在且状态为 shipping 或 arrived
      const order = await this.validateOrder(orderId, merchantId);
      if (!order) {
        return {
          success: false,
          message: "Order not found or status is not shipping/arrived",
        };
      }

      // 如果订单已经是 arrived 状态，不再更新位置（已经到达）
      if (order.status === OrderStatus.Arrived) {
        return {
          success: false,
          message: "Order has already arrived, no need to update location",
        };
      }

      // 更新数据库中的位置
      await this.updateOrderPositionInDB(orderId, coords);

      // 检查是否到达收货地址
      const isArrived = await this.checkAndUpdateArrivalStatus(
        orderId,
        coords,
        order.recipient_coords_geojson
      );

      // 通过 WebSocket 推送位置更新
      this.websocketManager.broadcastPositionUpdate(orderId, coords);

      if (isArrived) {
        return {
          success: true,
          message: "Location updated and order status changed to arrived",
        };
      }

      return { success: true };
    } catch (error) {
      console.error(
        `[LocationReceiver] Error receiving location update for order ${orderId}:`,
        error
      );
      return {
        success: false,
        message: (error as Error).message,
      };
    }
  }

  /**
   * 验证订单
   * 允许 shipping 和 arrived 状态的订单更新位置（arrived 状态可能是刚到达，还需要最后一次位置更新）
   */
  private async validateOrder(
    orderId: string,
    merchantId?: string
  ): Promise<{
    id: string;
    merchant_id: string;
    status: string;
    recipient_coords_geojson: string;
  } | null> {
    let sql = `
      SELECT 
        o.id,
        o.merchant_id,
        o.status,
        ST_AsGeoJSON(o.recipient_coords) AS recipient_coords_geojson
      FROM orders o
      WHERE o.id = $1 AND o.status IN ($2, $3)
    `;
    const params: (string | OrderStatus)[] = [
      orderId,
      OrderStatus.Shipping,
      OrderStatus.Arrived,
    ];

    if (merchantId) {
      sql += ` AND o.merchant_id = $4`;
      params.push(merchantId);
    }

    const rows = await query<{
      id: string;
      merchant_id: string;
      status: string;
      recipient_coords_geojson: string;
    }>(sql, params);

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * 更新数据库中的订单位置
   */
  private async updateOrderPositionInDB(
    orderId: string,
    coords: Coordinates
  ): Promise<void> {
    const pointWKT = coordsToPointWKT(coords);

    const sql = `
      UPDATE orders
      SET 
        current_position = ${wrapWKTToGeomFromText(pointWKT)},
        last_update_time = NOW()
      WHERE id = $1
    `;

    await query(sql, [orderId]);
  }

  /**
   * 检查是否到达收货地址，如果是则更新状态
   */
  private async checkAndUpdateArrivalStatus(
    orderId: string,
    currentCoords: Coordinates,
    recipientCoordsGeoJSON: string
  ): Promise<boolean> {
    // 解析收货地址坐标
    const recipientGeoJSON = JSON.parse(recipientCoordsGeoJSON);
    const recipientCoords: Coordinates = recipientGeoJSON.coordinates || [0, 0];

    // 计算距离
    const distance = this.calculateDistance(currentCoords, recipientCoords);

    // 如果距离小于阈值（默认 100 米），更新状态为 arrived
    const threshold = 100; // 米
    if (distance <= threshold) {
      const sql = `
        UPDATE orders
        SET 
          status = $1,
          last_update_time = NOW()
        WHERE id = $2
      `;

      await query(sql, [OrderStatus.Arrived, orderId]);
      console.log(`[LocationReceiver] Order ${orderId} arrived at destination`);

      // 通过 WebSocket 推送状态变更通知
      this.websocketManager.broadcastStatusUpdate(
        orderId,
        OrderStatus.Arrived,
        "包裹已到达，请准备收货"
      );

      return true;
    }

    return false;
  }

  /**
   * 计算两点之间的距离（米）- 使用 Haversine 公式
   */
  private calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
    const R = 6371000; // 地球半径（米）
    const lat1 = (coord1[1] * Math.PI) / 180;
    const lat2 = (coord2[1] * Math.PI) / 180;
    const deltaLat = ((coord2[1] - coord1[1]) * Math.PI) / 180;
    const deltaLon = ((coord2[0] - coord1[0]) * Math.PI) / 180;

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(deltaLon / 2) *
        Math.sin(deltaLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}
