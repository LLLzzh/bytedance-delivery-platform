import { query } from "../config/db.js";
import { Coordinates } from "../shared/geo.types.js";
import {
  OrderStatus,
  ShippingOrderRow,
  MockDeliveryOrder,
} from "../types/order.types.js";
import { config } from "../config/config.js";
import fetch from "node-fetch";

/**
 * 根据 ruleId 获取推送间隔（毫秒）
 * 配送时效越快，推送间隔越小
 */
function getIntervalByRuleId(ruleId: number): number {
  // 可以根据 ruleId 映射到不同的推送间隔
  // 例如：ruleId 1 = 快速配送（500ms），ruleId 2 = 标准配送（1000ms），ruleId 3 = 慢速配送（2000ms）
  const intervalMap: Record<number, number> = {
    101: 500, // 快速配送
    102: 1000, // 标准配送
    103: 2000, // 慢速配送
  };

  return intervalMap[ruleId] || config.positionUpdateInterval;
}

/**
 * 配送模拟器服务
 * 负责从数据库获取 shipping 状态的订单，按照路径推送位置到 worker 服务
 *
 * 推送策略：
 * - 持续推送所有路径点，按 ruleId 确定的间隔推送
 * - Worker 服务会根据是否有前端连接决定是否通过 WebSocket 推送
 */
export class DeliverySimulator {
  private activeDeliveries: Map<string, MockDeliveryOrder> = new Map();
  private deliveryTimers: Map<string, NodeJS.Timeout> = new Map();
  private reloadInterval: NodeJS.Timeout | null = null;

  /**
   * 从数据库加载所有 shipping 状态的订单
   */
  async loadShippingOrders(): Promise<void> {
    const sql = `
      SELECT 
        o.id,
        o.merchant_id,
        o.status,
        o.rule_id,
        ST_AsGeoJSON(o.route_path) AS route_path_geojson,
        ST_AsGeoJSON(o.recipient_coords) AS recipient_coords_geojson,
        ST_AsGeoJSON(o.current_position) AS current_position_geojson
      FROM orders o
      WHERE o.status = $1
    `;

    const rows: ShippingOrderRow[] = await query(sql, [OrderStatus.Shipping]);

    for (const row of rows) {
      // 如果已经在模拟中，跳过
      if (this.activeDeliveries.has(row.id)) {
        continue;
      }

      // 解析路径
      let routePath: Coordinates[] = [];
      if (row.route_path_geojson) {
        const routeGeoJSON = JSON.parse(row.route_path_geojson);
        if (
          routeGeoJSON.type === "LineString" &&
          Array.isArray(routeGeoJSON.coordinates)
        ) {
          routePath = routeGeoJSON.coordinates as Coordinates[];
        }
      }

      // 如果没有路径，跳过
      if (routePath.length === 0) {
        console.warn(
          `[DeliverySimulator] Order ${row.id} has no route path, skipping`
        );
        continue;
      }

      // 解析收货地址
      const recipientGeoJSON = JSON.parse(row.recipient_coords_geojson);
      const recipientCoords: Coordinates = recipientGeoJSON.coordinates || [
        0, 0,
      ];

      // 解析当前位置（如果有），找到最接近的路径点索引
      let currentPathIndex = 0;
      if (row.current_position_geojson) {
        const currentGeoJSON = JSON.parse(row.current_position_geojson);
        const currentCoords: Coordinates =
          currentGeoJSON.coordinates || routePath[0];
        currentPathIndex = this.findNearestPathIndex(routePath, currentCoords);
      }

      // 获取推送间隔
      const updateInterval = getIntervalByRuleId(row.rule_id);

      const mockOrder: MockDeliveryOrder = {
        orderId: row.id,
        merchantId: row.merchant_id,
        routePath,
        currentPathIndex,
        recipientCoords,
        ruleId: row.rule_id,
        updateInterval,
      };

      this.activeDeliveries.set(row.id, mockOrder);
      this.startDelivery(mockOrder);
    }

    console.log(
      `[DeliverySimulator] Loaded ${this.activeDeliveries.size} shipping orders`
    );
  }

  /**
   * 找到路径中最接近给定坐标的点索引
   */
  private findNearestPathIndex(
    routePath: Coordinates[],
    coords: Coordinates
  ): number {
    let minDistance = Infinity;
    let nearestIndex = 0;

    for (let i = 0; i < routePath.length; i++) {
      const distance = this.calculateDistance(routePath[i], coords);
      if (distance < minDistance) {
        minDistance = distance;
        nearestIndex = i;
      }
    }

    return nearestIndex;
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

  /**
   * 启动订单的配送模拟
   * 持续推送所有路径点，按 ruleId 确定的间隔推送
   */
  private startDelivery(order: MockDeliveryOrder): void {
    // 如果已经有定时器，先清除
    if (this.deliveryTimers.has(order.orderId)) {
      clearInterval(this.deliveryTimers.get(order.orderId)!);
    }

    const simulateMovement = async () => {
      // 如果已经到达路径终点，检查是否接近收货地址
      if (order.currentPathIndex >= order.routePath.length - 1) {
        const distance = this.calculateDistance(
          order.routePath[order.routePath.length - 1],
          order.recipientCoords
        );

        // 如果距离收货地址小于阈值，停止模拟
        if (distance <= config.arrivalThreshold) {
          this.stopDelivery(order.orderId);
          console.log(
            `[DeliverySimulator] Order ${order.orderId} arrived at destination`
          );
          return;
        }
      }

      // 移动到下一个路径点
      if (order.currentPathIndex < order.routePath.length - 1) {
        order.currentPathIndex++;
        const newPosition = order.routePath[order.currentPathIndex];

        // 推送位置到 worker 服务
        await this.pushLocationToWorker(
          order.orderId,
          newPosition,
          order.merchantId
        );
      } else {
        // 已经到达路径终点，停止模拟
        this.stopDelivery(order.orderId);
      }
    };

    // 启动定时器（使用正常的推送间隔）
    const timer = setInterval(simulateMovement, order.updateInterval);
    this.deliveryTimers.set(order.orderId, timer);

    // 立即执行一次
    simulateMovement().catch((error) => {
      console.error(
        `[DeliverySimulator] Error in delivery simulation for order ${order.orderId}:`,
        error
      );
    });

    console.log(
      `[DeliverySimulator] Started delivery simulation for order ${order.orderId} (Rule ${order.ruleId}, interval: ${order.updateInterval}ms)`
    );
  }

  /**
   * 推送位置到 worker 服务
   * @param orderId 订单ID
   * @param coords 位置坐标
   * @param merchantId 商家ID
   */
  private async pushLocationToWorker(
    orderId: string,
    coords: Coordinates,
    merchantId: string
  ): Promise<void> {
    try {
      const response = await fetch(
        `${config.workerUrl}/api/v1/location/update`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            orderId,
            coordinates: coords,
            merchantId,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        const errorData = JSON.parse(errorText);

        // 如果订单已经到达，停止该订单的模拟
        if (errorData.error && errorData.error.includes("already arrived")) {
          console.log(
            `[DeliverySimulator] Order ${orderId} has already arrived, stopping simulation`
          );
          this.stopDelivery(orderId);
          return;
        }

        // 如果订单状态不是 shipping，停止模拟
        if (errorData.error && errorData.error.includes("not shipping")) {
          console.log(
            `[DeliverySimulator] Order ${orderId} status changed, stopping simulation`
          );
          this.stopDelivery(orderId);
          return;
        }

        console.error(
          `[DeliverySimulator] Failed to push location for order ${orderId}: ${response.status} ${errorText}`
        );
      }
    } catch (error) {
      console.error(
        `[DeliverySimulator] Error pushing location for order ${orderId}:`,
        error
      );
    }
  }

  /**
   * 停止订单的配送模拟
   */
  private stopDelivery(orderId: string): void {
    const timer = this.deliveryTimers.get(orderId);
    if (timer) {
      clearInterval(timer);
      this.deliveryTimers.delete(orderId);
    }
    this.activeDeliveries.delete(orderId);
  }

  /**
   * 启动服务
   */
  start(): void {
    // 立即加载一次
    this.loadShippingOrders().catch((error) => {
      console.error("[DeliverySimulator] Error loading initial orders:", error);
    });

    // 定期重新加载订单（处理新发货的订单）
    this.reloadInterval = setInterval(() => {
      this.loadShippingOrders().catch((error) => {
        console.error("[DeliverySimulator] Error reloading orders:", error);
      });
    }, config.orderReloadInterval);

    console.log(
      `[DeliverySimulator] Started (reload interval: ${config.orderReloadInterval}ms)`
    );
  }

  /**
   * 停止服务
   */
  stop(): void {
    if (this.reloadInterval) {
      clearInterval(this.reloadInterval);
      this.reloadInterval = null;
    }

    // 停止所有配送模拟
    for (const orderId of this.deliveryTimers.keys()) {
      this.stopDelivery(orderId);
    }

    console.log("[DeliverySimulator] Stopped");
  }
}
