import { Redis } from "ioredis";
import { config } from "./config.js";

/**
 * Redis 客户端（用于存储订单异常类型等信息）
 */
export const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
});

// 监听连接事件
redis.on("connect", () => {
  console.log("[Redis] Connected to Redis");
});

redis.on("error", (error) => {
  console.error("[Redis] Redis error:", error);
});

redis.on("close", () => {
  console.log("[Redis] Redis connection closed");
});

/**
 * 订单异常类型的 Redis key 前缀
 */
export const ORDER_ANOMALY_KEY_PREFIX = "order:anomaly:";

/**
 * 设置订单的异常类型
 * @param orderId 订单ID
 * @param anomalyType 异常类型
 * @param ttl 过期时间（秒），默认 7 天
 */
export async function setOrderAnomalyType(
  orderId: string,
  anomalyType: string,
  ttl: number = 7 * 24 * 60 * 60 // 7 天
): Promise<void> {
  const key = `${ORDER_ANOMALY_KEY_PREFIX}${orderId}`;
  await redis.setex(key, ttl, anomalyType);
}

/**
 * 获取订单的异常类型
 * @param orderId 订单ID
 * @returns 异常类型，如果不存在则返回 null
 */
export async function getOrderAnomalyType(
  orderId: string
): Promise<string | null> {
  const key = `${ORDER_ANOMALY_KEY_PREFIX}${orderId}`;
  return await redis.get(key);
}

/**
 * 删除订单的异常类型
 * @param orderId 订单ID
 */
export async function deleteOrderAnomalyType(orderId: string): Promise<void> {
  const key = `${ORDER_ANOMALY_KEY_PREFIX}${orderId}`;
  await redis.del(key);
}
