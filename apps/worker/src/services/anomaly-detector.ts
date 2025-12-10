import { query, executeUpdate } from "../config/db.js";
import { OrderStatus } from "../types/order.types.js";
import { config } from "../config/config.js";

/**
 * 异常检测配置
 */
interface AnomalyConfig {
  // 从创建到发货的最大时间（毫秒），默认 2 小时
  maxPendingTime: number;
  // 从发货到到达的最大时间（毫秒），默认 4 小时
  maxShippingTime: number;
  // 位置更新间隔的最大时间（毫秒），默认 5 分钟（如果超过这个时间没有更新，可能异常）
  maxPositionUpdateGap: number;
  // 轨迹偏移的最大距离（米），默认 500 米（如果当前位置偏离路径超过这个距离，可能异常）
  maxRouteDeviation: number;
}

const DEFAULT_ANOMALY_CONFIG: AnomalyConfig = {
  maxPendingTime: 2 * 60 * 60 * 1000, // 2 小时
  maxShippingTime: 4 * 60 * 60 * 1000, // 4 小时
  maxPositionUpdateGap: 5 * 60 * 1000, // 5 分钟
  maxRouteDeviation: 5000, // 5000 米（5公里），如果偏移超过这个距离则标记为异常
};

/**
 * 异常检测服务
 * 负责检测订单异常并更新数据库
 */
export class AnomalyDetector {
  private checkInterval: NodeJS.Timeout | null = null;
  private abnormalReasonColumnExists: boolean | null = null; // 缓存字段存在性检查结果;
  private config: AnomalyConfig;

  constructor(anomalyConfig?: Partial<AnomalyConfig>) {
    this.config = { ...DEFAULT_ANOMALY_CONFIG, ...anomalyConfig };
  }

  /**
   * 检测所有订单的异常情况
   */
  async checkAllOrders(): Promise<void> {
    try {
      // 检查 pending 状态的订单（超过最大待处理时间）
      await this.checkPendingOrders();

      // 检查 shipping 状态的订单（超过最大配送时间、位置更新间隔过长、轨迹偏移）
      await this.checkShippingOrders();

      // 检查轨迹偏移
      await this.checkRouteDeviation();
    } catch (error) {
      console.error("[AnomalyDetector] Error checking orders:", error);
    }
  }

  /**
   * 检查 abnormal_reason 字段是否存在（带缓存）
   */
  private async checkAbnormalReasonColumn(): Promise<boolean> {
    if (this.abnormalReasonColumnExists !== null) {
      return this.abnormalReasonColumnExists;
    }

    try {
      const checkColumnSql = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'abnormal_reason'
      `;
      this.abnormalReasonColumnExists =
        (await query(checkColumnSql, [])).length > 0;
      return this.abnormalReasonColumnExists;
    } catch (error) {
      // 如果查询失败，假设字段不存在
      this.abnormalReasonColumnExists = false;
      return false;
    }
  }

  /**
   * 检查 pending 状态的订单
   */
  private async checkPendingOrders(): Promise<void> {
    const columnExists = await this.checkAbnormalReasonColumn();

    const reason = `订单待处理时间超过 ${this.config.maxPendingTime / 1000 / 60} 分钟`;
    const maxPendingSeconds = this.config.maxPendingTime / 1000;

    let sql: string;
    let params: (string | OrderStatus | number)[];

    if (columnExists) {
      sql = `
        UPDATE orders
        SET 
          is_abnormal = true,
          abnormal_reason = $1,
          last_update_time = NOW()
        WHERE 
          status = $2
          AND is_abnormal = false
          AND EXTRACT(EPOCH FROM (NOW() - create_time)) > $3
      `;
      params = [reason, OrderStatus.Pending, maxPendingSeconds];
    } else {
      // 如果字段不存在，只更新 is_abnormal
      sql = `
        UPDATE orders
        SET 
          is_abnormal = true,
          last_update_time = NOW()
        WHERE 
          status = $1
          AND is_abnormal = false
          AND EXTRACT(EPOCH FROM (NOW() - create_time)) > $2
      `;
      params = [OrderStatus.Pending, maxPendingSeconds];
    }

    const result = await query(sql, params);
    if (result.length > 0) {
      console.log(
        `[AnomalyDetector] Marked ${result.length} pending orders as abnormal`
      );
    }
  }

  /**
   * 检查 shipping 状态的订单
   */
  private async checkShippingOrders(): Promise<void> {
    const columnExists = await this.checkAbnormalReasonColumn();

    // 检查配送时间过长（从状态变为 shipping 开始计算）
    // 注意：这里需要找到订单状态变为 shipping 的时间，但数据库中没有这个字段
    // 所以我们使用 last_update_time 作为近似值（订单发货时会更新 last_update_time）
    const reason1 = `配送时间超过 ${this.config.maxShippingTime / 1000 / 60} 分钟`;
    const maxShippingSeconds = this.config.maxShippingTime / 1000;

    let sql1: string;
    let params1: (string | OrderStatus | number)[];

    if (columnExists) {
      sql1 = `
        UPDATE orders
        SET 
          is_abnormal = true,
          abnormal_reason = $1,
          last_update_time = NOW()
        WHERE 
          status = $2
          AND is_abnormal = false
          AND last_update_time IS NOT NULL
          AND EXTRACT(EPOCH FROM (NOW() - last_update_time)) > $3
      `;
      params1 = [reason1, OrderStatus.Shipping, maxShippingSeconds];
    } else {
      sql1 = `
        UPDATE orders
        SET 
          is_abnormal = true,
          last_update_time = NOW()
        WHERE 
          status = $1
          AND is_abnormal = false
          AND last_update_time IS NOT NULL
          AND EXTRACT(EPOCH FROM (NOW() - last_update_time)) > $2
      `;
      params1 = [OrderStatus.Shipping, maxShippingSeconds];
    }

    const result1 = await query(sql1, params1);
    if (result1.length > 0) {
      console.log(
        `[AnomalyDetector] Marked ${result1.length} shipping orders as abnormal (timeout)`
      );
    }

    // 检查位置更新间隔过长（可能卡住了）
    const reason2 = `位置更新间隔超过 ${this.config.maxPositionUpdateGap / 1000 / 60} 分钟，可能异常`;
    const maxGapSeconds = this.config.maxPositionUpdateGap / 1000;

    let sql2: string;
    let params2: (string | OrderStatus | number)[];

    if (columnExists) {
      sql2 = `
        UPDATE orders
        SET 
          is_abnormal = true,
          abnormal_reason = $1,
          last_update_time = NOW()
        WHERE 
          status = $2
          AND is_abnormal = false
          AND last_update_time IS NOT NULL
          AND EXTRACT(EPOCH FROM (NOW() - last_update_time)) > $3
      `;
      params2 = [reason2, OrderStatus.Shipping, maxGapSeconds];
    } else {
      sql2 = `
        UPDATE orders
        SET 
          is_abnormal = true,
          last_update_time = NOW()
        WHERE 
          status = $1
          AND is_abnormal = false
          AND last_update_time IS NOT NULL
          AND EXTRACT(EPOCH FROM (NOW() - last_update_time)) > $2
      `;
      params2 = [OrderStatus.Shipping, maxGapSeconds];
    }

    const result2 = await query(sql2, params2);
    if (result2.length > 0) {
      console.log(
        `[AnomalyDetector] Marked ${result2.length} shipping orders as abnormal (position gap)`
      );
    }
  }

  /**
   * 检查轨迹偏移
   * 对于 shipping 状态的订单，检查当前位置是否偏离规划的路径
   */
  private async checkRouteDeviation(): Promise<void> {
    const columnExists = await this.checkAbnormalReasonColumn();

    const reason = `轨迹偏移超过 ${this.config.maxRouteDeviation} 米`;

    // 查询所有 shipping 状态的订单，检查当前位置是否偏离路径
    const selectSql = `
      SELECT 
        o.id,
        ST_AsGeoJSON(o.current_position) AS current_position_geojson,
        ST_AsGeoJSON(o.route_path) AS route_path_geojson
      FROM orders o
      WHERE 
        o.status = $1
        AND o.is_abnormal = false
        AND o.current_position IS NOT NULL
        AND o.route_path IS NOT NULL
    `;

    const orders = await query<{
      id: string;
      current_position_geojson: string;
      route_path_geojson: string;
    }>(selectSql, [OrderStatus.Shipping]);

    console.log(
      `[AnomalyDetector] Checking route deviation for ${orders.length} shipping orders`
    );

    const deviatedOrderIds: string[] = [];

    for (const order of orders) {
      try {
        const currentGeoJSON = JSON.parse(order.current_position_geojson);
        const routeGeoJSON = JSON.parse(order.route_path_geojson);

        if (
          currentGeoJSON.type === "Point" &&
          routeGeoJSON.type === "LineString" &&
          Array.isArray(routeGeoJSON.coordinates)
        ) {
          const currentCoords: [number, number] =
            currentGeoJSON.coordinates || [0, 0];
          const routePath: [number, number][] = routeGeoJSON.coordinates || [];

          // 计算当前位置到路径的最短距离
          const minDistance = this.calculateMinDistanceToRoute(
            currentCoords,
            routePath
          );

          // 添加调试日志（只记录可能异常的订单）
          if (minDistance > this.config.maxRouteDeviation * 0.8) {
            console.log(
              `[AnomalyDetector] Order ${order.id}: ` +
                `current=[${currentCoords[0].toFixed(6)}, ${currentCoords[1].toFixed(6)}], ` +
                `minDistance=${minDistance.toFixed(2)}m, ` +
                `threshold=${this.config.maxRouteDeviation}m`
            );
          }

          // 如果距离超过阈值，标记为异常
          if (minDistance > this.config.maxRouteDeviation) {
            console.log(
              `[AnomalyDetector] ⚠️ Order ${order.id} detected route deviation: ` +
                `${minDistance.toFixed(2)}m > ${this.config.maxRouteDeviation}m ` +
                `(threshold exceeded by ${(minDistance - this.config.maxRouteDeviation).toFixed(2)}m)`
            );
            deviatedOrderIds.push(order.id);
          } else {
            // 即使没超过阈值，也记录一下（用于调试）
            if (minDistance > this.config.maxRouteDeviation * 0.5) {
              console.log(
                `[AnomalyDetector] Order ${order.id} distance: ${minDistance.toFixed(2)}m (below threshold ${this.config.maxRouteDeviation}m)`
              );
            }
          }
        }
      } catch (error) {
        console.error(
          `[AnomalyDetector] Error parsing coordinates for order ${order.id}:`,
          error
        );
      }
    }

    // 批量更新异常订单
    if (deviatedOrderIds.length > 0) {
      console.log(
        `[AnomalyDetector] Found ${deviatedOrderIds.length} orders with route deviation: ` +
          deviatedOrderIds.join(", ")
      );

      // 逐个更新订单，避免数组参数问题
      let updatedCount = 0;
      for (const orderId of deviatedOrderIds) {
        try {
          let updateSql: string;
          let params: (string | number)[];

          if (columnExists) {
            updateSql = `
              UPDATE orders
              SET 
                is_abnormal = true,
                abnormal_reason = $1,
                last_update_time = NOW()
              WHERE id = $2
            `;
            params = [reason, orderId];
          } else {
            updateSql = `
              UPDATE orders
              SET 
                is_abnormal = true,
                last_update_time = NOW()
              WHERE id = $1
            `;
            params = [orderId];
          }

          const rowCount = await executeUpdate(updateSql, params);
          if (rowCount > 0) {
            updatedCount++;
            console.log(
              `[AnomalyDetector] ✅ Updated order ${orderId} to abnormal (route deviation), rowCount=${rowCount}`
            );
          } else {
            console.warn(
              `[AnomalyDetector] ⚠️ No rows updated for order ${orderId} (order may not exist or already updated)`
            );
          }
        } catch (error) {
          console.error(
            `[AnomalyDetector] ❌ Error updating order ${orderId}:`,
            error
          );
        }
      }

      console.log(
        `[AnomalyDetector] ✅ Successfully marked ${updatedCount}/${deviatedOrderIds.length} orders as abnormal (route deviation)`
      );
    } else {
      console.log(
        `[AnomalyDetector] No orders with route deviation detected (checked ${orders.length} orders)`
      );
    }
  }

  /**
   * 计算点到路径的最短距离（米）
   * @param point 点坐标
   * @param routePath 路径坐标数组
   */
  private calculateMinDistanceToRoute(
    point: [number, number],
    routePath: [number, number][]
  ): number {
    if (routePath.length === 0) {
      return Infinity;
    }

    let minDistance = Infinity;

    // 计算到每个路径点的距离
    for (const routePoint of routePath) {
      const distance = this.calculateDistance(point, routePoint);
      if (distance < minDistance) {
        minDistance = distance;
      }
    }

    // 计算到路径段的最短距离（如果路径有多个点）
    for (let i = 0; i < routePath.length - 1; i++) {
      const segmentStart = routePath[i];
      const segmentEnd = routePath[i + 1];
      const distance = this.calculateDistanceToSegment(
        point,
        segmentStart,
        segmentEnd
      );
      if (distance < minDistance) {
        minDistance = distance;
      }
    }

    return minDistance;
  }

  /**
   * 计算点到线段的最短距离（米）
   * @param point 点坐标
   * @param segmentStart 线段起点
   * @param segmentEnd 线段终点
   */
  private calculateDistanceToSegment(
    point: [number, number],
    segmentStart: [number, number],
    segmentEnd: [number, number]
  ): number {
    // 使用球面几何计算点到线段的最短距离
    // 简化处理：计算点到线段两端点的距离，取较小值
    // 更精确的方法需要使用球面几何的投影计算，这里简化处理
    const distanceToStart = this.calculateDistance(point, segmentStart);
    const distanceToEnd = this.calculateDistance(point, segmentEnd);
    return Math.min(distanceToStart, distanceToEnd);
  }

  /**
   * 计算两点之间的距离（米）- 使用 Haversine 公式
   */
  private calculateDistance(
    coord1: [number, number],
    coord2: [number, number]
  ): number {
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
   * 启动异常检测循环
   */
  start(): void {
    if (this.checkInterval) {
      return;
    }

    this.checkInterval = setInterval(async () => {
      await this.checkAllOrders();
    }, config.anomalyCheckInterval);

    console.log(
      `[AnomalyDetector] Started anomaly detection loop (interval: ${config.anomalyCheckInterval}ms)`
    );
  }

  /**
   * 停止异常检测循环
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log("[AnomalyDetector] Stopped anomaly detection loop");
    }
  }
}
