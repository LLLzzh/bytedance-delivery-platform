import Redis from "ioredis";
import { config } from "../config/config.js";
import { Coordinates } from "../shared/geo.types.js";
import { LocationReceiver } from "./location-receiver.js";

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
 * MQ 消费者服务
 * 负责从 Redis 队列消费位置更新消息并处理
 */
export class MQConsumer {
  private redis: Redis;
  private queueName: string;
  private locationReceiver: LocationReceiver;
  private isConsuming: boolean = false;
  private consumeInterval: NodeJS.Timeout | null = null;
  private readonly pollInterval = 100; // 轮询间隔（毫秒）

  constructor(locationReceiver: LocationReceiver) {
    this.locationReceiver = locationReceiver;
    this.queueName = config.mqQueueName;

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

    // 监听连接事件
    this.redis.on("connect", () => {
      console.log("[MQConsumer] Connected to Redis");
    });

    this.redis.on("error", (error) => {
      console.error("[MQConsumer] Redis error:", error);
    });

    this.redis.on("close", () => {
      console.log("[MQConsumer] Redis connection closed");
    });
  }

  /**
   * 开始消费队列消息
   */
  start(): void {
    if (this.isConsuming) {
      console.warn("[MQConsumer] Already consuming messages");
      return;
    }

    this.isConsuming = true;
    console.log(`[MQConsumer] Started consuming from queue: ${this.queueName}`);

    // 使用轮询方式消费消息
    this.consumeInterval = setInterval(() => {
      this.consumeMessage().catch((error) => {
        console.error("[MQConsumer] Error consuming message:", error);
      });
    }, this.pollInterval);
  }

  /**
   * 停止消费队列消息
   */
  stop(): void {
    if (!this.isConsuming) {
      return;
    }

    this.isConsuming = false;

    if (this.consumeInterval) {
      clearInterval(this.consumeInterval);
      this.consumeInterval = null;
    }

    console.log("[MQConsumer] Stopped consuming messages");
  }

  /**
   * 从队列中消费一条消息
   */
  private async consumeMessage(): Promise<void> {
    try {
      // 使用 BRPOP 阻塞式弹出消息（右侧弹出，实现 FIFO）
      // 超时时间设为 1 秒，避免长时间阻塞
      // BRPOP 返回 null 如果没有消息（超时）
      const result = await this.redis.brpop(this.queueName, 1);

      if (!result || result.length < 2) {
        return; // 没有消息（超时）
      }

      const messageStr = result[1];
      let message: LocationUpdateMessage;

      try {
        message = JSON.parse(messageStr);
      } catch (parseError) {
        console.error(
          `[MQConsumer] Failed to parse message: ${messageStr}`,
          parseError
        );
        return; // 跳过无效消息
      }

      console.log(
        `[MQConsumer] Consumed location update for order ${message.orderId}`
      );

      // 处理位置更新
      const processResult = await this.locationReceiver.receiveLocationUpdate(
        message.orderId,
        message.coordinates,
        message.merchantId
      );

      if (!processResult.success) {
        // 如果处理失败，记录日志
        // 注意：这里可以根据业务需求决定是否重新入队
        console.warn(
          `[MQConsumer] Failed to process location update for order ${message.orderId}: ${processResult.message}`
        );

        // 如果订单已经到达或状态不是 shipping，这是正常情况，不需要重试
        if (
          processResult.message?.includes("already arrived") ||
          processResult.message?.includes("not shipping") ||
          processResult.message?.includes("Order not found")
        ) {
          console.log(
            `[MQConsumer] Order ${message.orderId} status changed or not found, skipping retry`
          );
          return;
        }
      }
    } catch (error) {
      console.error("[MQConsumer] Error consuming message:", error);
    }
  }

  /**
   * 关闭 Redis 连接
   */
  async close(): Promise<void> {
    this.stop();
    await this.redis.quit();
    console.log("[MQConsumer] Redis connection closed");
  }
}
