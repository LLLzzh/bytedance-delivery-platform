import { Coordinates } from "../../shared/geo.types.js";
import { OrderStatus } from "../order/order.types.js";

/**
 * 统计大屏数据响应类型
 */
export interface DashboardData {
  // 总单数
  totalOrders: number;
  // 完成率（百分比，0-100）
  completionRate: number;
  // 最近更新的物流动态
  recentLogisticsUpdates: LogisticsUpdate[];
  // 异常订单监控
  abnormalOrders: AbnormalOrder[];
  // 所有车辆的轨迹（当前正在配送的订单轨迹）
  vehicleTrajectories: VehicleTrajectory[];
  // 收货位置坐标（用于热力图）
  deliveryLocations: DeliveryLocation[];
  // 分省/分市收货数量统计
  deliveryStatisticsByRegion: DeliveryStatisticsByRegion;
  // 平均配送时间统计
  averageDeliveryTime: AverageDeliveryTime[];
}

/**
 * 物流动态更新
 */
export interface LogisticsUpdate {
  orderId: string;
  status: OrderStatus;
  statusText: string;
  updateTime: string;
  message?: string;
  // 如果状态是shipping或arrived，包含当前位置
  currentPosition?: Coordinates;
}

/**
 * 异常订单信息
 */
export interface AbnormalOrder {
  orderId: string;
  userId: string;
  recipientName: string;
  recipientAddress: string;
  status: OrderStatus;
  abnormalReason: string;
  createTime: string;
  lastUpdateTime?: string;
  // 异常持续时间（秒）
  abnormalDuration: number;
}

/**
 * 车辆轨迹（对应一个正在配送的订单）
 */
export interface VehicleTrajectory {
  orderId: string;
  vehicleId?: string; // 可选，如果系统中有车辆概念
  status: OrderStatus;
  // 规划路径
  routePath: Coordinates[];
  // 已走过的路径
  traveledPath: Coordinates[];
  // 当前位置
  currentPosition?: Coordinates;
  // 目的地坐标
  destination: Coordinates;
  // 最后更新时间
  lastUpdateTime?: string;
}

/**
 * 收货位置（用于热力图）
 */
export interface DeliveryLocation {
  coordinates: Coordinates;
  // 该位置的订单数量（用于热力图权重）
  orderCount: number;
  // 最近一次配送时间
  lastDeliveryTime?: string;
}

/**
 * 分省/分市收货数量统计（多层级数据，支持地图缩放）
 */
export interface DeliveryStatisticsByRegion {
  // 省份级别统计
  byProvince: ProvinceStatistics[];
  // 城市级别统计（可选，如果地址信息足够详细）
  byCity: CityStatistics[];
  // 经纬度级别统计（最精细，用于地图缩放）
  byCoordinates: DeliveryLocation[];
}

/**
 * 省份统计
 */
export interface ProvinceStatistics {
  province: string;
  orderCount: number;
  // 省份中心坐标（用于地图展示）
  centerCoordinates?: Coordinates;
}

/**
 * 城市统计
 */
export interface CityStatistics {
  province: string;
  city: string;
  orderCount: number;
  // 城市中心坐标
  centerCoordinates?: Coordinates;
}

/**
 * 平均配送时间统计
 */
export interface AverageDeliveryTime {
  // 分组键（省份、月份等）
  groupKey: string;
  // 分组类型：province（省份）、month（月份）
  groupType: "province" | "month";
  // 平均配送时间（小时）
  averageHours: number;
  // 平均配送时间（分钟）
  averageMinutes: number;
  // 订单数量
  orderCount: number;
}

/**
 * 统计大屏查询参数
 */
export interface DashboardQueryParams {
  // 时间范围（可选，默认最近24小时）
  startTime?: string;
  endTime?: string;
  // 限制返回的物流动态数量
  recentUpdatesLimit?: number;
  // 限制返回的异常订单数量
  abnormalOrdersLimit?: number;
  // 平均配送时间分组方式：province（省份）、month（月份）
  deliveryTimeGroupBy?: "province" | "month";
}
