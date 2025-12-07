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
 * 数据库返回的订单行类型（用于位置模拟）
 */
export interface ShippingOrderRow {
  id: string;
  merchant_id: string;
  status: OrderStatus;
  route_path_geojson: string | null;
  recipient_coords_geojson: string;
  current_position_geojson: string | null;
  create_time: Date;
  last_update_time: Date | null;
  is_abnormal: boolean;
  abnormal_reason: string | null;
}

/**
 * 位置模拟器中的订单状态
 */
export interface SimulatedOrder {
  orderId: string;
  merchantId: string;
  routePath: Coordinates[];
  currentPathIndex: number;
  recipientCoords: Coordinates;
  status: OrderStatus;
  createTime: Date;
  lastUpdateTime: Date | null;
  isAbnormal: boolean;
  abnormalReason: string | null;
}
