import Redis from "ioredis";
import { config } from "../config/config.js";
import { Coordinates } from "../shared/geo.types.js";

/**
 * 位置更新消息格式
 */
export interface LocationUpdateMessage {
  orderId: string;
  coordinates: Coordinates;
  merchantId: string;
  timestamp: number;
}

/**
 * MQ 发布者服务
 * 负责将位置更新消息发布到 Redis 队列
 */
export class MQPublisher {
  private redis: Redis;
  private queueName: string;

  constructor() {
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    this.queueName = config.mqQueueName;

    // 监听连接事件
    this.redis.on("connect", () => {
      console.log("[MQPublisher] Connected to Redis");
    });

    this.redis.on("error", (error) => {
      console.error("[MQPublisher] Redis error:", error);
    });

    this.redis.on("close", () => {
      console.log("[MQPublisher] Redis connection closed");
    });
  }

  /**
   * 发布位置更新消息到队列
   * @param orderId 订单ID
   * @param coords 位置坐标
   * @param merchantId 商家ID
   */
  async publishLocationUpdate(
    orderId: string,
    coords: Coordinates,
    merchantId: string
  ): Promise<void> {
    try {
      const message: LocationUpdateMessage = {
        orderId,
        coordinates: coords,
        merchantId,
        timestamp: Date.now(),
      };

      // 使用 LPUSH 将消息推入队列（左侧推入，右侧弹出，实现 FIFO）
      await this.redis.lpush(this.queueName, JSON.stringify(message));

      console.log(
        `[MQPublisher] Published location update for order ${orderId} to queue ${this.queueName}`
      );
    } catch (error) {
      console.error(
        `[MQPublisher] Error publishing location update for order ${orderId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * 关闭 Redis 连接
   */
  async close(): Promise<void> {
    await this.redis.quit();
    console.log("[MQPublisher] Redis connection closed");
  }
}
