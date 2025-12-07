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
  // 位置更新间隔（毫秒），默认 1 秒
  positionUpdateInterval: parseInt(
    process.env.POSITION_UPDATE_INTERVAL || "1000",
    10
  ),
  // 异常检测间隔（毫秒），默认 30 秒
  anomalyCheckInterval: parseInt(
    process.env.ANOMALY_CHECK_INTERVAL || "30000",
    10
  ),
  // 到达阈值（米），默认 100 米
  arrivalThreshold: parseInt(process.env.ARRIVAL_THRESHOLD || "100", 10),
};
