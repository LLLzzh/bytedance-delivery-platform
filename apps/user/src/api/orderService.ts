// src/api/orderService.ts
import axios from 'axios';

// 预留：以后填实际地址
const API_BASE_URL = 'https://your-api-domain.com'; // ← 替换为后端地址

// 商品项
export interface OrderGood {
  name: string;
  price: number;
  count: number;
  image: string;
}

// 物流记录
export interface LogisticsRecord {
  time: string;
  status: string;
}

// 订单数据
export interface Order {
  id: string;
  orderNo: string;
  merchantId?: string;
  merchantName: string;
  merchantAvatar: string;
  goods: OrderGood[];
  amount: number;
  status: 'pending' | 'shipping' | 'completed';
  deliveryStatus: string;
  createTime: string;
  logistics?: LogisticsRecord[];
}

// 商家信息
export interface Merchant {
  id: string;
  name: string;
  avatar: string;
  desc?: string;
}

// 获取订单列表
export const fetchOrders = async (params?: { page?: number; pageSize?: number }) => {
  try {
    const response = await axios.get<{ orders: Order[]; total: number }>(
      `${API_BASE_URL}/api/v1/orders`,
      { params }
    );
    return response.data;
  } catch (error) {
    console.error('获取订单失败:', error);
    throw error;
  }
};

// 获取订单详情
export const fetchOrderDetail = async (orderId: string): Promise<Order> => {
  try {
    const response = await axios.get<{ data: Order }>(
      `${API_BASE_URL}/api/v1/orders/${orderId}`
    );
    return response.data.data;
  } catch (error) {
    console.error('获取订单详情失败:', error);
    throw error;
  }
};

// 获取商家信息
export const fetchMerchantInfo = async (merchantId: string): Promise<Merchant> => {
  try {
    const response = await axios.get<{ data: Merchant }>(
      `${API_BASE_URL}/api/v1/merchants/${merchantId}`
    );
    return response.data.data;
  } catch (error) {
    console.error('获取商家信息失败:', error);
    throw error;
  }
};