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
  // Worker 服务的地址（接收位置推送）
  workerUrl: process.env.WORKER_URL || "http://localhost:3006",
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
};
