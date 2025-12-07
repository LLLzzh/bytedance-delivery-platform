import Fastify from "fastify";
import websocket from "@fastify/websocket";
import { initDatabase } from "./config/db.js";
import { config } from "./config/config.js";
import { WebSocketManager } from "./services/websocket-manager.js";
import { AnomalyDetector } from "./services/anomaly-detector.js";
import { LocationReceiver } from "./services/location-receiver.js";
import { Coordinates } from "./shared/geo.types.js";

// 创建 Fastify 实例
const fastify = Fastify({
  logger: true,
});

// 注册 WebSocket 插件
await fastify.register(websocket);

// 初始化服务
const websocketManager = new WebSocketManager(fastify);
const locationReceiver = new LocationReceiver(websocketManager);
const anomalyDetector = new AnomalyDetector();

// 注册 WebSocket 路由
websocketManager.registerRoutes();

// 健康检查路由
fastify.get("/health", async () => {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    connections: websocketManager.getTotalConnectionCount(),
  };
});

// 统计信息路由
fastify.get("/stats", async () => {
  return {
    totalConnections: websocketManager.getTotalConnectionCount(),
  };
});

// 接收位置推送的 API 接口（由 mock 物流端调用）
fastify.post("/api/v1/location/update", async (request, reply) => {
  try {
    const body = request.body as {
      orderId: string;
      coordinates: Coordinates;
      merchantId?: string;
    };

    if (!body.orderId || !body.coordinates) {
      return reply.code(400).send({
        success: false,
        error: "orderId and coordinates are required",
      });
    }

    const result = await locationReceiver.receiveLocationUpdate(
      body.orderId,
      body.coordinates,
      body.merchantId
    );

    if (result.success) {
      return { success: true, message: result.message };
    } else {
      return reply.code(400).send({
        success: false,
        error: result.message || "Failed to update location",
      });
    }
  } catch (error) {
    fastify.log.error(error);
    return reply.code(500).send({
      success: false,
      error: "Internal server error",
    });
  }
});

// 接收状态变更通知的 API 接口（由 API 服务调用）
fastify.post("/api/v1/status/update", async (request, reply) => {
  try {
    const body = request.body as {
      orderId: string;
      status: string;
      message?: string;
    };

    if (!body.orderId || !body.status) {
      return reply.code(400).send({
        success: false,
        error: "orderId and status are required",
      });
    }

    // 通过 WebSocket 推送状态变更
    websocketManager.broadcastStatusUpdate(
      body.orderId,
      body.status,
      body.message
    );

    return { success: true };
  } catch (error) {
    fastify.log.error(error);
    return reply.code(500).send({
      success: false,
      error: "Internal server error",
    });
  }
});

// 启动服务
const start = async () => {
  try {
    // 初始化数据库
    await initDatabase();

    // 启动异常检测器
    anomalyDetector.start();

    // 启动 HTTP/WebSocket 服务器
    await fastify.listen({ port: config.port, host: "0.0.0.0" });
    fastify.log.info(`Worker service listening on port ${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// 优雅关闭
const shutdown = async () => {
  console.log("[Worker] Shutting down...");

  anomalyDetector.stop();

  // 关闭 Fastify 服务器
  await fastify.close();

  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// 启动服务
start();
