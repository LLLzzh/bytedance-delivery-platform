import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { config } from "./config/config";
import { initDatabase } from "./config/db";
import { fenceController } from "./modules/fence/fence.controller";
import { ruleController } from "./modules/rules/rules.controller";
import { merchantController } from "./modules/merchant/merchant.controller";
import { orderController } from "./modules/order/order.controller";

const fastify = Fastify({
  logger: true,
});

// Register plugins
await fastify.register(helmet);
await fastify.register(cors, {
  origin: true,
});

// Health check route
fastify.get("/health", async () => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

// Register application routes
fastify.register(fenceController, { prefix: "/api/v1/fences" });
fastify.register(ruleController, { prefix: "/api/v1/delivery-rules" });
fastify.register(merchantController, { prefix: "/api/v1/merchant" });
fastify.register(orderController, { prefix: "/api/v1/orders" });

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: config.port, host: "0.0.0.0" });
    fastify.log.info(`Server listening on port ${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }

  initDatabase();
};

start();
