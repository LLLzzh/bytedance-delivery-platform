import { initDatabase } from "./config/db.js";
import { DeliverySimulator } from "./services/delivery-simulator.js";

// 初始化配送模拟器
const deliverySimulator = new DeliverySimulator();

// 启动服务
const start = async () => {
  try {
    // 初始化数据库
    await initDatabase();

    // 启动配送模拟器
    deliverySimulator.start();

    console.log("[MockLogistics] Service started");
  } catch (err) {
    console.error("[MockLogistics] Failed to start:", err);
    process.exit(1);
  }
};

// 优雅关闭
const shutdown = async () => {
  console.log("[MockLogistics] Shutting down...");
  deliverySimulator.stop();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// 启动服务
start();
