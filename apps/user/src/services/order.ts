import { apiClient } from "./api-client";

/**
 * 订单状态枚举（与后端保持一致）
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
 * 坐标类型
 */
export type Coordinates = [number, number];

/**
 * 订单实体（与后端保持一致）
 */
export interface Order {
  id: string;
  userId: string;
  merchantId: string;
  createTime: string;
  amount: number;
  status: OrderStatus;
  recipientName: string;
  recipientAddress: string;
  recipientCoords: Coordinates;
  lastUpdateTime?: string;
  eta?: string;
  currentPosition?: Coordinates;
  routePath?: Coordinates[];
  traveledPath?: Coordinates[];
  ruleId?: number;
  isAbnormal: boolean;
  abnormalReason?: string;
}

/**
 * 订单列表查询参数
 */
export interface OrderListQuery {
  page?: number;
  pageSize?: number;
  userId?: string;
  status?: string;
  searchQuery?: string;
  isAbnormal?: boolean; // 是否异常订单筛选
  sortBy?: "createTime" | "amount" | "status" | "recipientName";
  sortDirection?: "ASC" | "DESC";
}

/**
 * 分页订单列表响应
 */
export interface PaginatedOrderList {
  success: boolean;
  orders: Order[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
}

/**
 * 订单详情响应
 */
export interface OrderDetailResponse {
  success: boolean;
  order: Order;
  realtimeTracking?: boolean;
}

/**
 * 订单路径数据
 */
export interface OrderPathData {
  success: boolean;
  data: {
    orderId: string;
    routePath: Coordinates[];
    traveledPath: Coordinates[];
    currentPosition?: Coordinates;
    status: OrderStatus;
    lastUpdateTime?: string;
  };
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
 * 创建订单请求参数
 */
export interface CreateOrderRequest {
  userId: string;
  amount: number;
  recipientName: string;
  recipientAddress: string;
  recipientCoords: Coordinates;
  merchantId?: string;
  anomalyType?: AnomalyType; // 异常订单类型（可选）
}

/**
 * 创建订单响应
 */
export interface CreateOrderResponse {
  success: boolean;
  order: Order;
}

/**
 * 订单服务
 */
export const orderService = {
  /**
   * 创建订单
   */
  async createOrder(data: CreateOrderRequest): Promise<CreateOrderResponse> {
    const response = await apiClient.post<CreateOrderResponse>(
      "/api/v1/orders",
      data
    );
    // extractData 总是返回一个对象，但 TypeScript 认为 data 可能是 undefined
    // 实际上根据 extractData 的实现，它总是会返回一个 ApiResponse 对象
    // 如果后端直接返回业务数据，extractData 会将其包装在 data 字段中
    // 如果后端返回的数据已经是 ApiResponse 格式，则直接返回
    // 这里使用类型断言，因为实际运行时总是有值的
    return (response.data ?? response) as CreateOrderResponse;
  },

  /**
   * 获取订单列表
   */
  async getOrders(params?: OrderListQuery): Promise<PaginatedOrderList> {
    const response = await apiClient.get<PaginatedOrderList>("/api/v1/orders", {
      params,
    });
    return (response.data ?? response) as PaginatedOrderList;
  },

  /**
   * 获取订单详情
   */
  async getOrderDetail(orderId: string): Promise<OrderDetailResponse> {
    const response = await apiClient.get<OrderDetailResponse>(
      `/api/v1/orders/${orderId}`
    );
    return (response.data ?? response) as OrderDetailResponse;
  },

  /**
   * 获取订单路径历史
   */
  async getOrderPath(orderId: string): Promise<OrderPathData> {
    const response = await apiClient.get<OrderPathData>(
      `/api/v1/orders/${orderId}/path`
    );
    return (response.data ?? response) as OrderPathData;
  },

  /**
   * 确认收货
   */
  async confirmDelivery(
    orderId: string
  ): Promise<{ success: boolean; message: string; data: { order: Order } }> {
    const response = await apiClient.post<{
      success: boolean;
      message: string;
      data: { order: Order };
    }>(`/api/v1/orders/${orderId}/deliver`);
    // extractData 已经返回完整的 ApiResponse（包含 success 字段），直接返回 response
    return response as unknown as {
      success: boolean;
      message: string;
      data: { order: Order };
    };
  },
};
