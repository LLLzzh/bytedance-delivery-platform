export interface Order {
  id: string;
  orderNo: string;
  status: string;
  productName: string;
  productImage: string;
  fromAddress: string;
  toAddress: string;
}

export interface TimelineItem {
  time: string;
  date: string;
  status: string;
  detail: string;
  icon?: string;
}

export interface LogisticsInfo {
  orderId: string;
  path: [number, number][];
  currentPos: [number, number];
  timeline: TimelineItem[];
}

export const mockOrders: Order[] = [
  {
    id: "1",
    orderNo: "KD100234",
    status: "运输中",
    productName: "iPhone 15 Pro Max",
    productImage:
      "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=200&h=200&fit=crop",
    fromAddress: "杭州市余杭区阿里巴巴西溪园区",
    toAddress: "上海市浦东新区陆家嘴中心",
  },
  {
    id: "2",
    orderNo: "KD100235",
    status: "已签收",
    productName: "Sony WH-1000XM5",
    productImage:
      "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=200&h=200&fit=crop",
    fromAddress: "北京市朝阳区",
    toAddress: "杭州市西湖区",
  },
  {
    id: "3",
    orderNo: "KD100236",
    status: "派送中",
    productName: "Logitech MX Master 3S",
    productImage:
      "https://images.unsplash.com/photo-1631281928516-5463f88360c7?w=200&h=200&fit=crop",
    fromAddress: "深圳市南山区",
    toAddress: "广州市天河区",
  },
];

export const mockLogistics: Record<string, LogisticsInfo> = {
  "1": {
    orderId: "1",
    // 杭州西溪 -> 上海陆家嘴 (Simplified path)
    path: [
      [120.026208, 30.279212], // Start: Alibaba Xixi
      [120.05, 30.28],
      [120.1, 30.29],
      [120.15, 30.3],
      [120.2, 30.31],
      [120.3, 30.35], // Moving towards Shanghai
      [120.5, 30.5],
      [120.8, 30.8],
      [121.1, 31.0],
      [121.3, 31.15],
      [121.4, 31.2],
      [121.5, 31.23], // End: Lujiazui approx
    ],
    currentPos: [120.8, 30.8], // Somewhere in between
    timeline: [
      {
        time: "14:30",
        date: "12-08",
        status: "运输中",
        detail: "快件已到达嘉兴转运中心，正发往上海",
      },
      {
        time: "09:15",
        date: "12-08",
        status: "已发货",
        detail: "包裹已从杭州西溪园区发出",
      },
      {
        time: "08:30",
        date: "12-08",
        status: "已揽件",
        detail: "顺丰速运已收取快件",
      },
      {
        time: "08:00",
        date: "12-08",
        status: "已下单",
        detail: "商家已接单，准备发货",
      },
    ],
  },
  "2": {
    orderId: "2",
    path: [
      [116.4074, 39.9042], // Beijing
      [118.7969, 32.0603], // Nanjing
      [120.1551, 30.2741], // Hangzhou
    ],
    currentPos: [120.1551, 30.2741],
    timeline: [
      {
        time: "10:00",
        date: "12-07",
        status: "已签收",
        detail: "您的快件已由本人签收，感谢使用",
      },
      {
        time: "08:00",
        date: "12-07",
        status: "派送中",
        detail: "快递员正在派送中",
      },
    ],
  },
  "3": {
    orderId: "3",
    path: [
      [113.93029, 22.53291], // Shenzhen Nanshan
      [113.32446, 23.10647], // Guangzhou
    ],
    currentPos: [113.6, 22.8],
    timeline: [
      {
        time: "11:20",
        date: "12-08",
        status: "派送中",
        detail: "快递员正在派送中，请保持电话畅通",
      },
      {
        time: "06:00",
        date: "12-08",
        status: "运输中",
        detail: "快件已到达广州天河集散中心",
      },
    ],
  },
};
