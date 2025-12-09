import * as DashboardRepository from "./dashboard.repository.js";
import { DashboardData, DashboardQueryParams } from "./dashboard.types.js";

const MOCK_MERCHANT_ID = "10001";

/**
 * 获取统计大屏数据
 * @param params 查询参数
 * @returns 统计大屏数据
 */
export async function getDashboardData(
  params: DashboardQueryParams = {}
): Promise<DashboardData> {
  const {
    recentUpdatesLimit = 50,
    abnormalOrdersLimit = 100,
    deliveryTimeGroupBy = "province",
  } = params;

  // 并行查询所有数据，提高性能
  const [
    totalOrders,
    completionRate,
    recentLogisticsUpdates,
    abnormalOrders,
    vehicleTrajectories,
    deliveryLocations,
    deliveryStatisticsByRegion,
    averageDeliveryTime,
  ] = await Promise.all([
    DashboardRepository.getTotalOrdersCount(MOCK_MERCHANT_ID),
    DashboardRepository.getCompletionRate(MOCK_MERCHANT_ID),
    DashboardRepository.getRecentLogisticsUpdates(
      recentUpdatesLimit,
      MOCK_MERCHANT_ID
    ),
    DashboardRepository.getAbnormalOrders(
      abnormalOrdersLimit,
      MOCK_MERCHANT_ID
    ),
    DashboardRepository.getVehicleTrajectories(MOCK_MERCHANT_ID),
    DashboardRepository.getDeliveryLocations(MOCK_MERCHANT_ID),
    DashboardRepository.getDeliveryStatisticsByRegion(MOCK_MERCHANT_ID),
    DashboardRepository.getAverageDeliveryTime(
      deliveryTimeGroupBy,
      MOCK_MERCHANT_ID
    ),
  ]);

  return {
    totalOrders,
    completionRate,
    recentLogisticsUpdates,
    abnormalOrders,
    vehicleTrajectories,
    deliveryLocations,
    deliveryStatisticsByRegion,
    averageDeliveryTime,
  };
}
