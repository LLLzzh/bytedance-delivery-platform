import Fastify from "fastify";
import { initDatabase } from "./config/db.js";
import { DeliverySimulator } from "./services/delivery-simulator.js";
import { config } from "./config/config.js";

// 创建 Fastify 实例
const app = Fastify({
  logger: true,
});

// 初始化配送模拟器
const deliverySimulator = new DeliverySimulator();

// 健康检查路由
app.get("/health", async () => {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
  };
});

// 启动服务
const start = async () => {
  try {
    // 初始化数据库
    await initDatabase();

    // 启动配送模拟器
    deliverySimulator.start();

    // 启动 HTTP 服务器
    await app.listen({ port: config.port, host: "0.0.0.0" });
    app.log.info(`Mock Logistics service listening on port ${config.port}`);
  } catch (err) {
    console.error("[MockLogistics] Failed to start:", err);
    process.exit(1);
  }
};

// 优雅关闭
const shutdown = async () => {
  console.log("[MockLogistics] Shutting down...");
  deliverySimulator.stop();
  await app.close();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// 启动服务
start();
