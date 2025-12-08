import { Coordinates, RoutePath } from "../../shared/geo.types.js";
/**
 * 订单状态枚举
 */
export enum OrderStatus {
  Pending = "pending", // 待处理
  PickedUp = "pickedUp", // 已取件
  Shipping = "shipping", // 运输中 (开始实时追踪)
  Arrived = "arrived", // 已到达（靠近目的地）
  Delivered = "delivered", // 已签收
  Cancelled = "cancelled", // 已取消
}

/**
 * 完整的订单实体 (对应数据库 orders 表结构)
 */
export interface Order {
  // === 核心身份与状态 ===
  id: string;
  userId: string;
  merchantId: string;
  createTime: string; // TIMESTAMP WITH TIME ZONE
  amount: number;
  status: OrderStatus;

  // === 地理信息与地址 ===
  recipientName: string;
  recipientAddress: string;

  // **对应 PostGIS GEOGRAPHY(Point, 4326) 字段**
  // 数据库交互时，需要将其转换为 POINT(lon lat) 或 GeoJSON
  recipientCoords: Coordinates;

  // === 实时追踪信息 (Nullable/Updateable) ===
  lastUpdateTime?: string;
  eta?: string; // 预计到达时间

  // **对应 PostGIS GEOGRAPHY(Point, 4326) 字段**
  currentPosition?: Coordinates;

  routePath?: Coordinates[]; // 完整规划路径
  traveledPath?: Coordinates[]; // 已走过的路径点（从起点到当前位置）
  ruleId?: number;

  // === 异常监控 ===
  isAbnormal: boolean;
  abnormalReason?: string;
}

/**
 * 创建订单时所需的输入数据 (DTO - Data Transfer Object)
 * 排除数据库自动生成的字段 (id, createTime, status, etc.)
 */
export interface CreateOrderDTO {
  userId: string;
  amount: number;
  recipientName: string;
  recipientAddress: string;
  recipientCoords: Coordinates;
  merchantId: string;
}

export interface DeliveryCheckResult {
  isDeliverable: boolean;
  ruleId: number | null; // 如果在范围内，返回匹配到的围栏规则ID
}

// 订单列表查询参数 DTO
export interface OrderListQueryDTO {
  // === 分页 ===
  page: number;
  pageSize: number;

  // === 筛选/搜索 ===
  userId?: string;
  status?: string;
  searchQuery?: string;

  // === 排序 (新增) ===
  // 明确列出前端可以排序的字段（驼峰命名）
  sortBy?: "createTime" | "amount" | "status" | "recipientName";
  sortDirection?: "ASC" | "DESC";
}
// 订单列表返回结构 (包含总数)
export interface PaginatedOrderList {
  orders: Order[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
}
// 数据库返回的原始订单行类型
export interface OrderRow {
  // 数据库字段名使用下划线
  id: string; // UUID
  user_id: string;
  merchant_id: string;
  create_time: Date; // pg 库通常会返回 Date 对象
  amount: string | number; // 数据库可能是 NUMERIC，返回时可能是 string
  status: OrderStatus;
  recipient_name: string;
  recipient_address: string;
  rule_id: number;

  // P3 字段
  current_position?: Coordinates; // 原始 GEOGRAPHY 或 null
  last_update_time?: Date | null;
  route_path?: RoutePath;
  is_abnormal: boolean;
  route_path_geojson?: string | null;

  // 自定义的 GeoJSON 转换字段 (用于 mapRowToOrder 解析坐标)
  recipient_coords_geojson: string;
  current_position_geojson?: string;
}

// OrderListQueryDTO 返回的 COUNT(*) 结果行
export interface CountRow {
  count: string;
}
