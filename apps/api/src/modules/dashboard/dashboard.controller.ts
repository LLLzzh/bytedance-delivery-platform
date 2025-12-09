import { FastifyInstance } from "fastify";
import * as DashboardService from "./dashboard.service.js";
import { DashboardQueryParams } from "./dashboard.types.js";

/**
 * 统计大屏控制器
 */
export async function dashboardController(fastify: FastifyInstance) {
  /**
   * GET /api/v1/dashboard
   * 获取统计大屏数据
   *
   * Query Parameters:
   * - recentUpdatesLimit: 最近物流动态数量限制（默认50）
   * - abnormalOrdersLimit: 异常订单数量限制（默认100）
   * - startTime: 开始时间（ISO 8601格式，可选）
   * - endTime: 结束时间（ISO 8601格式，可选）
   * - deliveryTimeGroupBy: 平均配送时间分组方式，province（省份）或 month（月份），默认province
   */
  fastify.get("/", async (request, reply) => {
    try {
      const queryParams = request.query as {
        recentUpdatesLimit?: string;
        abnormalOrdersLimit?: string;
        startTime?: string;
        endTime?: string;
        deliveryTimeGroupBy?: "province" | "month";
      };

      const params: DashboardQueryParams = {
        recentUpdatesLimit: queryParams.recentUpdatesLimit
          ? parseInt(queryParams.recentUpdatesLimit, 10)
          : undefined,
        abnormalOrdersLimit: queryParams.abnormalOrdersLimit
          ? parseInt(queryParams.abnormalOrdersLimit, 10)
          : undefined,
        startTime: queryParams.startTime,
        endTime: queryParams.endTime,
        deliveryTimeGroupBy:
          queryParams.deliveryTimeGroupBy === "month" ? "month" : "province",
      };

      // 参数校验
      if (
        params.recentUpdatesLimit !== undefined &&
        (params.recentUpdatesLimit < 1 || params.recentUpdatesLimit > 500)
      ) {
        return reply.code(400).send({
          success: false,
          error: "recentUpdatesLimit must be between 1 and 500",
        });
      }

      if (
        params.abnormalOrdersLimit !== undefined &&
        (params.abnormalOrdersLimit < 1 || params.abnormalOrdersLimit > 1000)
      ) {
        return reply.code(400).send({
          success: false,
          error: "abnormalOrdersLimit must be between 1 and 1000",
        });
      }

      const dashboardData = await DashboardService.getDashboardData(params);

      return {
        success: true,
        data: dashboardData,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(
        "[DashboardController] Error fetching dashboard data:",
        error
      );
      return reply.code(500).send({
        success: false,
        error: "Failed to fetch dashboard data",
        message: (error as Error).message,
      });
    }
  });
}
