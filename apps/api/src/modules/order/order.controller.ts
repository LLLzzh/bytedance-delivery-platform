// src/modules/order/order.controller.ts

import { FastifyInstance } from "fastify";
import * as OrderService from "./order.service.js";
import * as OrderRepository from "./order.repository";
import { CreateOrderSchema, ShippingSchema } from "./order.schema";
import { CreateOrderDTO, OrderListQueryDTO } from "./order.types.js";
import { Coordinates } from "../../shared/geo.types.js";

// ⚠️ 模拟商家 ID (待加入认证系统后移除)
const MOCK_MERCHANT_ID = "10001";
const MOCK_USER_ID = "d74823ab-1234-4a2a-b9c2-9e909a7b746c";

export async function orderController(fastify: FastifyInstance) {
  // P2.1: POST /api/v1/orders - 创建订单 (核心逻辑)
  fastify.post("/", async (request, reply) => {
    // 1. Zod 校验
    const validationResult = CreateOrderSchema.safeParse(request.body);

    if (!validationResult.success) {
      return reply.code(400).send({
        error: "Invalid Input",
        details: validationResult.error.format(),
      });
    }

    // 增加 merchantId 字段，完成 DTO
    const data: CreateOrderDTO = {
      ...validationResult.data,
      merchantId: MOCK_MERCHANT_ID, // 模拟设置 merchantId
    };

    try {
      // 2. 调用 Service 层，执行“校验 + 创建”流程
      const newOrder = await OrderService.createNewOrder(data);

      // 3. 返回响应
      return reply.code(201).send({
        success: true,
        order: newOrder,
      });
    } catch (error) {
      console.error(error);
      // 捕获 Service 层抛出的业务错误
      if ((error as Error).message.includes("delivery range")) {
        return reply.code(400).send({ error: (error as Error).message });
      }
      reply.code(500).send({ error: (error as Error).message });
    }
  });

  // P2.2: GET /api/v1/orders/:id - 查询订单详情（返回已走过的路径点，不建立 WebSocket）
  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      // 调用 Service 层查询
      const order = await OrderService.getOrderDetails(id, MOCK_MERCHANT_ID);

      // 返回订单详情，包含已走过的路径点（traveledPath）
      // 前端可以根据 traveledPath 渲染静态路径，无需建立 WebSocket 连接
      return {
        success: true,
        order: {
          ...order,
          // 明确说明：如需实时追踪，请使用 WebSocket 连接 ws://worker:3001/ws/:orderId
          realtimeTracking: false,
        },
      };
    } catch (error) {
      // 捕获 Service 抛出的 "not found" 错误
      if ((error as Error).message.includes("not found")) {
        return reply.code(404).send({ error: (error as Error).message });
      }
      console.error(error);
      reply.code(500).send({ error: "Failed to retrieve order details." });
    }
  });

  // GET /api/v1/orders/:id/path - 获取订单路径历史（已走过的路径点）
  fastify.get("/:id/path", async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const order = await OrderService.getOrderDetails(id, MOCK_MERCHANT_ID);

      return {
        success: true,
        data: {
          orderId: id,
          // 完整规划路径
          routePath: order.routePath || [],
          // 已走过的路径点
          traveledPath: order.traveledPath || [],
          // 当前位置
          currentPosition: order.currentPosition,
          // 订单状态
          status: order.status,
          // 最后更新时间
          lastUpdateTime: order.lastUpdateTime,
        },
      };
    } catch (error) {
      if ((error as Error).message.includes("not found")) {
        return reply.code(404).send({ error: (error as Error).message });
      }
      console.error(error);
      reply.code(500).send({ error: "Failed to retrieve order path." });
    }
  });

  // P2.3: GET /api/v1/orders/check-delivery - 独立配送范围查询 (保持不变，直接调用 Repository)
  fastify.get("/check-delivery", async (request, reply) => {
    const { lng, lat } = request.query as { lng: string; lat: string };
    const coords: Coordinates = [parseFloat(lng), parseFloat(lat)];

    if (isNaN(coords[0]) || isNaN(coords[1])) {
      return reply.code(400).send({ error: "Invalid coordinates provided." });
    }

    try {
      const checkResult = await OrderRepository.checkDeliveryRange(coords);

      return {
        isDeliverable: checkResult.isDeliverable,
        ruleId: checkResult.ruleId,
        message: checkResult.isDeliverable
          ? "Address is within delivery range."
          : "Address is outside delivery range.",
      };
    } catch (error) {
      console.error(error);
      reply.code(500).send({ error: "Failed to perform delivery check." });
    }
  });

  // GET /api/v1/orders/statistics - 获取订单统计信息
  fastify.get("/statistics", async (request, reply) => {
    try {
      const statistics = await OrderService.getOrderStatistics();
      return {
        success: true,
        data: statistics,
      };
    } catch (error) {
      console.error(error);
      reply.code(500).send({ error: "Failed to fetch order statistics." });
    }
  });

  // P2.4: GET /api/v1/orders - 获取订单列表 (支持分页/筛选/搜索)
  fastify.get("/", async (request, reply) => {
    // 1. 从 Query String 中解析参数，并处理类型转换
    const queryParams = request.query as {
      page?: string;
      pageSize?: string;
      userId?: string;
      status?: string;
      searchQuery?: string;
      // 排序
      sortBy?: "createTime" | "amount" | "status" | "recipientName";
      sortDirection?: "ASC" | "DESC";
    };

    const finalQueryParams: OrderListQueryDTO = {
      page: parseInt(queryParams.page || "1", 10),
      pageSize: parseInt(queryParams.pageSize || "20", 10),
      userId: queryParams.userId,
      status: queryParams.status,
      searchQuery: queryParams.searchQuery,
      // 排序参数
      sortBy: queryParams.sortBy,
      sortDirection: queryParams.sortDirection,
    };

    // 2. 校验分页参数的有效性 (简单检查)
    if (
      finalQueryParams.page < 1 ||
      finalQueryParams.pageSize < 1 ||
      finalQueryParams.pageSize > 100
    ) {
      return reply.code(400).send({ error: "Invalid pagination parameters." });
    }

    try {
      const result = await OrderService.findOrdersList(finalQueryParams);

      return { success: true, ...result };
    } catch (error) {
      console.error(error);
      // 捕获 Repository 中抛出的无效排序字段错误
      if ((error as Error).message.includes("Invalid sort column")) {
        return reply.code(400).send({ error: (error as Error).message });
      }
      reply.code(500).send({ error: "Failed to fetch paginated order list." });
    }
  });

  // POST /api/v1/orders/:id/ship - 订单发货/开始 Mock 追踪
  // src/modules/order/order.controller.ts (更新后的路由处理器)

  fastify.post("/:id/ship", async (request, reply) => {
    const { id: orderId } = request.params as { id: string };
    const merchantId = MOCK_MERCHANT_ID; // 假设 MOCK_MERCHANT_ID 仍是常量

    // 1. 校验请求体
    const validationResult = ShippingSchema.safeParse(request.body);
    if (!validationResult.success) {
      // HTTP 400 Bad Request
      return reply.code(400).send({
        success: false,
        message: "Invalid shipping input: Request body validation failed.",
        errors: validationResult.error.format(), // 返回详细的 Zod 错误信息
      });
    }

    const { ruleId, routePath } = validationResult.data;

    try {
      // 2. 调用 Service 启动发货
      const filteredRoutePath: Coordinates[] = Array.isArray(routePath)
        ? routePath.filter(
            (pt: unknown): pt is Coordinates =>
              Array.isArray(pt) &&
              pt.length === 2 &&
              typeof pt[0] === "number" &&
              typeof pt[1] === "number"
          )
        : [];

      const updatedOrder = await OrderService.startShipping({
        orderId,
        merchantId,
        ruleId,
        routePath: filteredRoutePath,
      });

      // 3. 返回成功的响应
      // 遵循最新逻辑：所有订单都启动追踪 (mockTracking: 'Started')
      // HTTP 200 OK
      return reply.code(200).send({
        success: true,
        message: `Order shipped successfully with Rule ID ${ruleId}. Tracking started.`,
        data: {
          order: updatedOrder,
          mockTracking: "Started", // 所有订单都启动追踪
        },
      });
    } catch (error) {
      const err = error as Error;

      // 检查业务错误 (例如：订单未找到，或状态不是 pending)
      if (
        err.message.includes("not found") ||
        err.message.includes("not pending")
      ) {
        // HTTP 404 Not Found 或 409 Conflict
        return reply.code(404).send({
          success: false,
          message: err.message,
        });
      }

      // 打印详细错误到日志
      console.error(`Error during shipping for Order ${orderId}:`, err);

      // HTTP 500 Internal Server Error
      return reply.code(500).send({
        success: false,
        message:
          "Internal server error: Failed to start shipping due to system fault.",
      });
    }
  });

  // POST /api/v1/orders/:id/deliver - 用户确认收货/完成订单
  fastify.post("/:id/deliver", async (request, reply) => {
    const { id: orderId } = request.params as { id: string };
    const userId = MOCK_USER_ID;

    try {
      // 1. 调用 Service 确认收货
      const deliveredOrder = await OrderService.deliverOrder(orderId, userId);

      // 2. 通知 Worker 服务状态变更（异步，不阻塞响应）
      // 使用 setImmediate 确保不阻塞响应返回
      setImmediate(async () => {
        try {
          const workerUrl = process.env.WORKER_URL || "http://localhost:3006";
          // Node.js 18+ 内置 fetch，如果不可用则跳过通知
          if (typeof globalThis.fetch !== "undefined") {
            await globalThis.fetch(`${workerUrl}/api/v1/status/update`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                orderId,
                status: "delivered",
                message: "订单已签收",
              }),
            });
          }
        } catch (notifyError) {
          // Worker 通知失败不影响主流程，只记录日志
          console.warn(
            `[OrderController] Failed to notify worker service:`,
            notifyError
          );
        }
      });

      // 3. 返回成功的响应
      return reply.code(200).send({
        success: true,
        message: `Order ${orderId} successfully marked as delivered.`,
        data: {
          order: deliveredOrder,
        },
      });
    } catch (error) {
      const err = error as Error;

      // 捕获 Repository 抛出的业务错误
      if (
        err.message.includes("not found") ||
        err.message.includes("not arrived")
      ) {
        // HTTP 404 Not Found 或 409 Conflict
        return reply.code(409).send({
          success: false,
          message: err.message,
        });
      }

      console.error(`Error during delivery for Order ${orderId}:`, err);

      // HTTP 500 Internal Server Error
      return reply.code(500).send({
        success: false,
        message: "Internal server error: Failed to complete delivery.",
      });
    }
  });
}
