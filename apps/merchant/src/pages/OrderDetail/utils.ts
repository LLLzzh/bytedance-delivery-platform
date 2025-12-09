// 订单详情页工具函数

import { Order, OrderStatus } from "../../services/order";
import { LogisticsLog, OrderGood } from "./types";

/**
 * 根据订单状态和时间生成物流日志
 */
export function generateLogisticsLogs(order: Order): LogisticsLog[] {
  const logs: LogisticsLog[] = [];
  const createTime = new Date(order.createTime);

  // 订单创建成功
  logs.push({
    time: createTime.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
    status: "订单创建成功",
  });

  // 根据订单状态添加后续日志
  if (order.status !== "pending") {
    // 商家已发货
    const shipTime = order.lastUpdateTime
      ? new Date(order.lastUpdateTime)
      : new Date(createTime.getTime() + 5 * 60 * 1000); // 默认创建后5分钟发货

    logs.push({
      time: shipTime.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
      status: "商家已发货",
    });

    // 如果订单在运输中，添加车辆启动日志
    if (["shipping", "pickedUp", "arrived"].includes(order.status)) {
      const startTime = new Date(shipTime.getTime() + 25 * 60 * 1000); // 发货后25分钟启动
      logs.push({
        time: startTime.toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
        status: "车辆已启动,开始运输",
      });
    }

    // 如果订单已送达
    if (order.status === "delivered") {
      const deliverTime = order.lastUpdateTime
        ? new Date(order.lastUpdateTime)
        : new Date(createTime.getTime() + 2 * 60 * 60 * 1000); // 默认创建后2小时送达

      logs.push({
        time: deliverTime.toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
        status: "订单已送达",
      });
    }
  }

  // 按时间倒序排列（最新的在前）
  return logs.reverse();
}

/**
 * 根据订单金额生成模拟商品信息
 */
export function generateOrderGoods(order: Order): OrderGood[] {
  // 根据订单金额模拟商品信息
  // 这里可以根据实际业务需求调整
  return [
    {
      name: "高性能机械键盘",
      price: order.amount,
      count: 1,
      image: undefined, // 可以后续添加默认图片
    },
  ];
}

/**
 * 格式化订单号（添加前缀）
 */
export function formatOrderNo(orderId: string): string {
  // 从订单ID中提取数字部分，如果ID是UUID格式，则使用后3位
  const match = orderId.match(/\d+/);
  if (match) {
    const numStr = match[0];
    const lastThree = numStr.slice(-3).padStart(3, "0");
    return `#ORD-${lastThree}`;
  }
  // 如果没有数字，使用ID的后3位字符
  return `#ORD-${orderId.slice(-3).padStart(3, "0")}`;
}

/**
 * 格式化价格（添加千分位分隔符）
 */
export function formatPrice(price: number): string {
  return price.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * 格式化创建时间
 */
export function formatCreateTime(isoString: string): string {
  return new Date(isoString).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/**
 * 生成模拟手机号（脱敏）
 */
export function generateMaskedPhone(): string {
  // 生成模拟手机号，格式: 138****1234
  const prefix = "138";
  const suffix = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `${prefix}****${suffix}`;
}

/**
 * 获取订单状态显示文本
 */
export function getStatusText(status: OrderStatus): string {
  const statusMap: Record<OrderStatus, string> = {
    pending: "待发货",
    pickedUp: "已取货",
    shipping: "运输中",
    arrived: "已到达",
    delivered: "已送达",
    cancelled: "已取消",
  };
  return statusMap[status] || status;
}
