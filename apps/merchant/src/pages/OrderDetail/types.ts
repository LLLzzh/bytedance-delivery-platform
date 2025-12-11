// 订单详情页类型定义

export interface LogisticsLog {
  date: string; // 格式: "MM-DD"
  time: string; // 格式: "HH:mm"
  status: string; // 状态描述
}

export interface OrderGood {
  name: string;
  price: number;
  count: number;
  image?: string;
}

export interface OrderDetailData {
  orderNo: string;
  createTime: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  goods: OrderGood[];
  logisticsLogs: LogisticsLog[];
  status: string;
  amount: number;
}
