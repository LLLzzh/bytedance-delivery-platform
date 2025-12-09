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
 * 订单服务
 */
export const orderService = {
  /**
   * 获取订单列表
   */
  async getOrders(params?: OrderListQuery): Promise<PaginatedOrderList> {
    const response = await apiClient.get<PaginatedOrderList>("/api/v1/orders", {
      params,
    });
    return response.data;
  },

  /**
   * 获取订单详情
   */
  async getOrderDetail(orderId: string): Promise<OrderDetailResponse> {
    const response = await apiClient.get<OrderDetailResponse>(
      `/api/v1/orders/${orderId}`
    );
    return response.data;
  },

  /**
   * 获取订单路径历史
   */
  async getOrderPath(orderId: string): Promise<OrderPathData> {
    const response = await apiClient.get<OrderPathData>(
      `/api/v1/orders/${orderId}/path`
    );
    return response.data;
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
    return response.data;
  },
};
