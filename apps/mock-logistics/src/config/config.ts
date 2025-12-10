import dotenv from "dotenv";

dotenv.config();

export const config = {
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
  // 位置推送间隔（毫秒），默认 1 秒
  positionUpdateInterval: parseInt(
    process.env.POSITION_UPDATE_INTERVAL || "1000",
    10
  ),
  // 订单重新加载间隔（毫秒），默认 30 秒
  orderReloadInterval: parseInt(
    process.env.ORDER_RELOAD_INTERVAL || "30000",
    10
  ),
  // 到达阈值（米），默认 100 米
  arrivalThreshold: parseInt(process.env.ARRIVAL_THRESHOLD || "100", 10),
  // Mock Logistics 服务端口
  port: parseInt(process.env.PORT || "3005", 10),
};
