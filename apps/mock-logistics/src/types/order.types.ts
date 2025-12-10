import { Coordinates } from "../shared/geo.types.js";

/**
 * 订单状态枚举
 */
export enum OrderStatus {
  Pending = "pending",
  PickedUp = "pickedUp",
  Shipping = "shipping",
  Arrived = "arrived",
  Delivered = "delivered",
  Cancelled = "cancelled",
}

/**
 * 异常订单类型枚举
 */
export enum AnomalyType {
  None = "none", // 正常订单
  RouteDeviation = "routeDeviation", // 轨迹偏移
  LongTimeStopped = "longTimeStopped", // 长时间轨迹不动
  LongTimeNoUpdate = "longTimeNoUpdate", // 长时间状态未更新
}

/**
 * 数据库返回的订单行类型
 */
export interface ShippingOrderRow {
  id: string;
  merchant_id: string;
  status: OrderStatus;
  route_path_geojson: string | null;
  recipient_coords_geojson: string;
  current_position_geojson: string | null;
  rule_id: number;
}

/**
 * 模拟配送中的订单
 */
export interface MockDeliveryOrder {
  orderId: string;
  merchantId: string;
  routePath: Coordinates[];
  currentPathIndex: number;
  recipientCoords: Coordinates;
  ruleId: number;
  updateInterval: number; // 推送间隔（毫秒）
  anomalyType: AnomalyType; // 异常类型
}
