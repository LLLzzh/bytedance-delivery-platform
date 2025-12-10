import { query } from "../config/db.js";
import { Coordinates } from "../shared/geo.types.js";
import {
  OrderStatus,
  ShippingOrderRow,
  MockDeliveryOrder,
  AnomalyType,
} from "../types/order.types.js";
import { config } from "../config/config.js";
import { MQPublisher } from "./mq-publisher.js";
import { Redis } from "ioredis";

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
 * - 通过 MQ（Redis）推送位置更新，实现服务解耦
 * - Worker 服务会根据是否有前端连接决定是否通过 WebSocket 推送
 */
export class DeliverySimulator {
  private activeDeliveries: Map<string, MockDeliveryOrder> = new Map();
  private deliveryTimers: Map<string, NodeJS.Timeout> = new Map();
  private reloadInterval: NodeJS.Timeout | null = null;
  private mqPublisher: MQPublisher;
  private redis: Redis;

  constructor() {
    this.mqPublisher = new MQPublisher();
    // 初始化 Redis 客户端（用于读取订单异常类型）
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    this.redis.on("connect", () => {
      console.log("[DeliverySimulator] Connected to Redis");
    });

    this.redis.on("error", (error) => {
      console.error("[DeliverySimulator] Redis error:", error);
    });
  }

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

      // 从 Redis 读取异常类型
      const anomalyType = await this.getAnomalyTypeFromRedis(row.id);

      console.log(
        `[DeliverySimulator] Order ${row.id} loaded with anomalyType: ${anomalyType}`
      );

      const mockOrder: MockDeliveryOrder = {
        orderId: row.id,
        merchantId: row.merchant_id,
        routePath,
        currentPathIndex,
        recipientCoords,
        ruleId: row.rule_id,
        updateInterval,
        anomalyType,
      };

      this.activeDeliveries.set(row.id, mockOrder);
      this.startDelivery(mockOrder);
    }

    console.log(
      `[DeliverySimulator] Loaded ${this.activeDeliveries.size} shipping orders`
    );
  }

  /**
   * 从 Redis 读取订单的异常类型
   * @param orderId 订单ID
   * @returns 异常类型
   */
  private async getAnomalyTypeFromRedis(orderId: string): Promise<AnomalyType> {
    try {
      const key = `order:anomaly:${orderId}`;
      const anomalyType = await this.redis.get(key);
      console.log(
        `[DeliverySimulator] Reading anomaly type from Redis for order ${orderId}: key=${key}, value=${anomalyType}`
      );
      if (
        anomalyType &&
        Object.values(AnomalyType).includes(anomalyType as AnomalyType)
      ) {
        console.log(
          `[DeliverySimulator] Found valid anomaly type: ${anomalyType} for order ${orderId}`
        );
        return anomalyType as AnomalyType;
      } else {
        console.log(
          `[DeliverySimulator] No valid anomaly type found for order ${orderId}, using None`
        );
      }
    } catch (error) {
      console.warn(
        `[DeliverySimulator] Failed to get anomaly type from Redis for order ${orderId}:`,
        error
      );
    }
    return AnomalyType.None;
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
   * 支持异常情况：轨迹偏移、长时间不动、长时间未更新
   */
  private startDelivery(order: MockDeliveryOrder): void {
    // 如果已经有定时器，先清除
    if (this.deliveryTimers.has(order.orderId)) {
      clearInterval(this.deliveryTimers.get(order.orderId)!);
    }

    // 异常订单的特殊处理
    console.log(
      `[DeliverySimulator] Starting delivery for order ${order.orderId} with anomalyType: ${order.anomalyType}`
    );

    if (order.anomalyType === AnomalyType.LongTimeNoUpdate) {
      // 长时间未更新：不推送位置更新
      console.log(
        `[DeliverySimulator] Order ${order.orderId} is set to longTimeNoUpdate, will not push location updates`
      );
      return;
    }

    // 用于长时间不动的计数器
    let stoppedCounter = 0;
    let stoppedPosition: Coordinates | null = null;

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

      // 处理异常情况
      let newPosition: Coordinates;

      if (order.anomalyType === AnomalyType.RouteDeviation) {
        // 轨迹偏移：推送偏离正常路径的坐标
        if (order.currentPathIndex < order.routePath.length - 1) {
          // 先递增索引，获取下一个正常路径点
          order.currentPathIndex++;
          const normalPosition = order.routePath[order.currentPathIndex];

          // 随机偏移 6-8 公里（必须大于 worker 的检测阈值 5 公里，才能被检测到异常）
          const offsetDistance = 6000 + Math.random() * 2000; // 6-8公里
          const offsetAngle = Math.random() * 2 * Math.PI; // 随机角度
          newPosition = this.calculateOffsetPosition(
            normalPosition,
            offsetDistance,
            offsetAngle
          );

          // 计算实际偏移距离（用于验证）
          const actualDistance = this.calculateDistance(
            normalPosition,
            newPosition
          );

          console.log(
            `[DeliverySimulator] RouteDeviation for order ${order.orderId} (index ${order.currentPathIndex}): ` +
              `normal=[${normalPosition[0].toFixed(6)}, ${normalPosition[1].toFixed(6)}], ` +
              `offset=[${newPosition[0].toFixed(6)}, ${newPosition[1].toFixed(6)}], ` +
              `intended=${offsetDistance.toFixed(2)}m, actual=${actualDistance.toFixed(2)}m`
          );
        } else {
          newPosition = order.routePath[order.routePath.length - 1];
        }
      } else if (order.anomalyType === AnomalyType.LongTimeStopped) {
        // 长时间轨迹不动：推送相同坐标多次
        if (order.currentPathIndex < order.routePath.length - 1) {
          // 在某个位置停留多次（例如停留5次）
          if (stoppedCounter === 0) {
            // 第一次到达这个位置，记录位置
            stoppedPosition = order.routePath[order.currentPathIndex];
          }
          if (stoppedCounter < 5 && stoppedPosition) {
            // 在同一个位置停留5次
            newPosition = stoppedPosition;
            stoppedCounter++;
          } else {
            // 停留5次后继续前进
            order.currentPathIndex++;
            newPosition = order.routePath[order.currentPathIndex];
            stoppedCounter = 0;
            stoppedPosition = null;
          }
        } else {
          newPosition = order.routePath[order.routePath.length - 1];
        }
      } else {
        // 正常订单：按路径推送
        if (order.currentPathIndex < order.routePath.length - 1) {
          order.currentPathIndex++;
          newPosition = order.routePath[order.currentPathIndex];
        } else {
          // 已经到达路径终点，停止模拟
          this.stopDelivery(order.orderId);
          return;
        }
      }

      // 推送位置到 worker 服务
      await this.pushLocationToWorker(
        order.orderId,
        newPosition,
        order.merchantId
      );
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

    const anomalyInfo =
      order.anomalyType !== AnomalyType.None
        ? `, anomaly: ${order.anomalyType}`
        : "";
    console.log(
      `[DeliverySimulator] Started delivery simulation for order ${order.orderId} (Rule ${order.ruleId}, interval: ${order.updateInterval}ms${anomalyInfo})`
    );
  }

  /**
   * 计算偏移位置（用于轨迹偏移异常）
   * @param basePosition 基准位置
   * @param distanceMeters 偏移距离（米）
   * @param angleRadians 偏移角度（弧度）
   */
  private calculateOffsetPosition(
    basePosition: Coordinates,
    distanceMeters: number,
    angleRadians: number
  ): Coordinates {
    const R = 6371000; // 地球半径（米）
    const lat1 = (basePosition[1] * Math.PI) / 180;
    const lon1 = (basePosition[0] * Math.PI) / 180;

    // 计算偏移后的位置
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(distanceMeters / R) +
        Math.cos(lat1) * Math.sin(distanceMeters / R) * Math.cos(angleRadians)
    );
    const lon2 =
      lon1 +
      Math.atan2(
        Math.sin(angleRadians) * Math.sin(distanceMeters / R) * Math.cos(lat1),
        Math.cos(distanceMeters / R) - Math.sin(lat1) * Math.sin(lat2)
      );

    return [(lon2 * 180) / Math.PI, (lat2 * 180) / Math.PI];
  }

  /**
   * 推送位置到 worker 服务（通过 MQ）
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
      // 通过 MQ 发布位置更新消息
      await this.mqPublisher.publishLocationUpdate(orderId, coords, merchantId);
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
  async stop(): Promise<void> {
    if (this.reloadInterval) {
      clearInterval(this.reloadInterval);
      this.reloadInterval = null;
    }

    // 停止所有配送模拟
    for (const orderId of this.deliveryTimers.keys()) {
      this.stopDelivery(orderId);
    }

    // 关闭 MQ 发布者连接
    await this.mqPublisher.close();

    // 关闭 Redis 连接
    await this.redis.quit();

    console.log("[DeliverySimulator] Stopped");
  }
}
