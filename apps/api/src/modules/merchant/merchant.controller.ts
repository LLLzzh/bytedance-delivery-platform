import { FastifyInstance } from "fastify";
import * as MerchantRepository from "./merchant.repository.js";

export async function merchantController(fastify: FastifyInstance) {
  // C1.1: GET /api/v1/merchant/config
  fastify.get("/config", async (request, reply) => {
    try {
      const config = await MerchantRepository.getMerchantConfig();

      if (!config) {
        return reply
          .code(404)
          .send({ error: "Merchant configuration not found." });
      }

      // 响应体结构与需求文档保持一致
      return {
        merchant_id: config.merchantId,
        location: config.location,
      };
    } catch (error) {
      console.error(error);
      reply.code(500).send({ error: "Failed to retrieve merchant config." });
    }
  });
}
