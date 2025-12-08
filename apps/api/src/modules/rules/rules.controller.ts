import { FastifyInstance } from "fastify";
import * as RuleRepository from "./rules.repository";

export async function ruleController(fastify: FastifyInstance) {
  // C1.2: GET /api/v1/delivery-rules
  fastify.get("/", async (request, reply) => {
    try {
      const rules = await RuleRepository.findAllDeliveryRules();

      return rules;
    } catch (error) {
      console.error(error);
      reply.code(500).send({ error: "Failed to retrieve delivery rules." });
    }
  });
}
