import { FastifyInstance } from "fastify";
import { CreateFenceSchema } from "./fence.schema.js";
import { CreateFenceDTO } from "./fence.types.js";
import * as FenceService from "./fence.service.js";

export async function fenceController(fastify: FastifyInstance) {
  // C2.2: POST /api/v1/fences - 新增围栏
  fastify.post("/", async (request, reply) => {
    // 1. Zod 校验
    const validationResult = CreateFenceSchema.safeParse(request.body);

    if (!validationResult.success) {
      return reply.code(400).send({
        error: "Invalid Input",
        details: validationResult.error.format(),
      });
    }

    const data: CreateFenceDTO = validationResult.data;

    try {
      // 2. 调用 Service 层进行创建
      const newFence = await FenceService.createFenceData(data);

      // 3. 返回响应
      return reply.code(201).send({
        success: true,
        fence: newFence,
      });
    } catch (error) {
      console.error(error);
      reply.code(500).send({ error: (error as Error).message });
    }
  });

  // C2.1: GET /api/v1/fences - 获取围栏列表
  fastify.get("/", async (request, reply) => {
    try {
      // 调用 Service 层获取列表
      const fences = await FenceService.findAllFences();
      return {
        success: true,
        fences: fences,
      };
    } catch (error) {
      console.error(error);
      reply.code(500).send({ error: "Failed to fetch fences." });
    }
  });

  // C2.4: DELETE /api/v1/fences/:id - 删除围栏
  fastify.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const fenceId = parseInt(id);
    if (isNaN(fenceId)) {
      return reply.code(400).send({ error: "Invalid fence ID." });
    }

    try {
      // 调用 Service 层进行删除
      await FenceService.deleteFenceData(fenceId);
      return reply
        .code(200)
        .send({ success: true, message: `Fence ${fenceId} deleted.` });
    } catch (error) {
      // 可以处理 Service 抛出的删除失败错误
      console.error(error);
      reply.code(500).send({ error: "Failed to delete fence." });
    }
  });

  // C2.3: PUT /api/v1/fences/:id - 更新围栏
  fastify.put("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const fenceId = parseInt(id);

    if (isNaN(fenceId)) {
      return reply.code(400).send({ error: "Invalid fence ID." });
    }

    // 1. Zod 校验 (与 POST 使用同样的 schema)
    const validationResult = CreateFenceSchema.safeParse(request.body);

    if (!validationResult.success) {
      return reply
        .code(400)
        .send({
          error: "Invalid Input",
          details: validationResult.error.format(),
        });
    }

    const data: CreateFenceDTO = validationResult.data;

    try {
      // 2. 调用 Service 层进行更新
      const updatedFence = await FenceService.updateFenceData(fenceId, data);

      return { success: true, fence: updatedFence };
    } catch (error) {
      // 假设 Service 抛出 "not found" 错误
      if ((error as Error).message.includes("not found")) {
        return reply.code(404).send({ error: (error as Error).message });
      }
      console.error(error);
      reply.code(500).send({ error: "Failed to update fence." });
    }
  });

  // C2.3: GET /api/v1/fences/:id - 查询单个围栏 (新增)
  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const fenceId = parseInt(id);

    if (isNaN(fenceId)) {
      return reply.code(400).send({ error: "Invalid fence ID." });
    }

    try {
      // 调用 Service 层查询
      const fence = await FenceService.getFenceById(fenceId);
      return { success: true, fence: fence };
    } catch (error) {
      // 假设 Service 抛出 "not found" 错误
      if ((error as Error).message.includes("not found")) {
        return reply.code(404).send({ error: (error as Error).message });
      }
      console.error(error);
      reply.code(500).send({ error: "Failed to retrieve fence." });
    }
  });
}
