import { apiClient } from "./api-client";

export type OrderStatus =
  | "pending"
  | "pickedUp"
  | "shipping"
  | "arrived"
  | "delivered"
  | "cancelled";

export type Coordinates = [number, number];

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

export interface CreateOrderDTO {
  userId: string;
  amount: number;
  recipientName: string;
  recipientAddress: string;
  recipientCoords: Coordinates;
  merchantId: string;
}

export interface OrderListQuery {
  page?: number;
  pageSize?: number;
  userId?: string;
  status?: string;
  searchQuery?: string;
  sortBy?: "createTime" | "amount" | "status" | "recipientName";
  sortDirection?: "ASC" | "DESC";
}

export interface PaginatedOrderList {
  orders: Order[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
}

export interface OrderPathData {
  orderId: string;
  routePath: Coordinates[];
  traveledPath: Coordinates[];
  currentPosition?: Coordinates;
  status: OrderStatus;
  lastUpdateTime?: string;
}

export interface DeliveryCheckResult {
  isDeliverable: boolean;
  ruleId: number | null;
  message: string;
}

export interface ShippingRequest {
  ruleId: number;
  routePath: Coordinates[];
}

interface OrderResponse {
  success: boolean;
  order: Order;
}

interface OrderListResponse {
  success: boolean;
  orders: Order[];
  totalCount: number;
  currentPage?: number;
  pageSize?: number;
}

interface OrderPathResponse {
  success: boolean;
  data: OrderPathData;
}

interface ShippingResponse {
  success: boolean;
  message: string;
  data: {
    order: Order;
    mockTracking: string;
  };
}

export interface OrderStatistics {
  pendingCount: number;
  shippingCount: number;
  completedCount: number;
  totalGMV: number;
}

interface OrderStatisticsResponse {
  success: boolean;
  data: OrderStatistics;
}

export const orderService = {
  /**
   * 获取订单列表
   */
  async getOrders(params: OrderListQuery = {}): Promise<PaginatedOrderList> {
    const response = await apiClient
      .getInstance()
      .get<OrderListResponse>("/api/v1/orders", {
        params: {
          page: params.page || 1,
          pageSize: params.pageSize || 20,
          ...(params.userId && { userId: params.userId }),
          ...(params.status && { status: params.status }),
          ...(params.searchQuery && { searchQuery: params.searchQuery }),
          ...(params.sortBy && { sortBy: params.sortBy }),
          ...(params.sortDirection && { sortDirection: params.sortDirection }),
        },
      });
    // 后端直接返回 { success: true, orders: [...], totalCount: ... }
    const data = response.data as OrderListResponse;
    return {
      orders: data?.orders || [],
      totalCount: data?.totalCount || 0,
      currentPage: params.page || 1,
      pageSize: params.pageSize || 20,
    };
  },

  /**
   * 获取订单详情
   */
  async getOrderById(id: string): Promise<Order> {
    const response = await apiClient
      .getInstance()
      .get<OrderResponse>(`/api/v1/orders/${id}`);
    const data = response.data as OrderResponse;
    return data.order;
  },

  /**
   * 获取订单路径历史
   */
  async getOrderPath(id: string): Promise<OrderPathData> {
    const response = await apiClient
      .getInstance()
      .get<OrderPathResponse>(`/api/v1/orders/${id}/path`);
    const data = response.data as OrderPathResponse;
    return data.data;
  },

  /**
   * 检查配送范围
   */
  async checkDeliveryRange(
    lng: number,
    lat: number
  ): Promise<DeliveryCheckResult> {
    const response = await apiClient
      .getInstance()
      .get<DeliveryCheckResult>("/api/v1/orders/check-delivery", {
        params: { lng, lat },
      });
    // 后端返回 { isDeliverable: boolean, ruleId: number | null, message: string }
    return response.data as DeliveryCheckResult;
  },

  /**
   * 创建订单
   */
  async createOrder(data: CreateOrderDTO): Promise<Order> {
    const response = await apiClient
      .getInstance()
      .post<OrderResponse>("/api/v1/orders", data);
    const resData = response.data as OrderResponse;
    return resData.order;
  },

  /**
   * 订单发货
   */
  async shipOrder(id: string, shippingData: ShippingRequest): Promise<Order> {
    // 数据清理已在 prepareShippingData 中完成，这里直接发送
    const response = await apiClient
      .getInstance()
      .post<ShippingResponse>(`/api/v1/orders/${id}/ship`, shippingData);
    const resData = response.data as ShippingResponse;
    return resData.data.order;
  },

  /**
   * 确认收货
   */
  async deliverOrder(id: string): Promise<Order> {
    const response = await apiClient
      .getInstance()
      .post<OrderResponse>(`/api/v1/orders/${id}/deliver`);
    const resData = response.data as OrderResponse;
    return resData.order;
  },

  /**
   * 获取订单统计信息
   */
  async getOrderStatistics(): Promise<OrderStatistics> {
    const response = await apiClient
      .getInstance()
      .get<OrderStatisticsResponse>("/api/v1/orders/statistics");
    const data = response.data as OrderStatisticsResponse;
    return data.data;
  },
};
