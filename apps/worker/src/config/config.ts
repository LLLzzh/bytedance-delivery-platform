import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: parseInt(process.env.WORKER_PORT || "3006", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  db: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    database: process.env.DB_NAME || "mydb",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
  },
  // Redis 配置（用于 MQ）
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  // MQ 队列名称
  mqQueueName: process.env.MQ_QUEUE_NAME || "location-updates",
  // 位置更新间隔（毫秒），默认 1 秒
  positionUpdateInterval: parseInt(
    process.env.POSITION_UPDATE_INTERVAL || "1000",
    10
  ),
  // 异常检测间隔（毫秒），默认 10 秒（更频繁的检测）
  anomalyCheckInterval: parseInt(
    process.env.ANOMALY_CHECK_INTERVAL || "10000",
    10
  ),
  // 到达阈值（米），默认 100 米
  arrivalThreshold: parseInt(process.env.ARRIVAL_THRESHOLD || "100", 10),
};
