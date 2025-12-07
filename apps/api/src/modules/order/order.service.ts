import * as OrderRepository from "./order.repository";
import {
  CreateOrderDTO,
  Order,
  OrderListQueryDTO,
  PaginatedOrderList,
} from "./order.types.js";
import { mapRowToOrder } from "./order.repository.js";
import { Coordinates } from "../../shared/geo.types";
import { MOCK_ROUTE_POINTS } from "./order.route.config.js";

const MOCK_MERCHANT_ID = "10001";

// ----------------------------------------------------------------------
// P2.1 Service: 创建订单（核心业务流程）
// ----------------------------------------------------------------------

/**
 * 核心业务：创建订单，包含配送范围校验。
 * @param data 订单创建数据
 * @returns 创建成功的订单实体
 */
export async function createNewOrder(data: CreateOrderDTO): Promise<Order> {
  const { recipientCoords } = data;

  // 1. 核心校验：检查收货地址是否在配送范围内
  const checkResult = await OrderRepository.checkDeliveryRange(recipientCoords);

  if (!checkResult.isDeliverable) {
    // 抛出业务错误，Controller 层负责将其转换为 400 Bad Request
    throw new Error("Recipient address is outside of the delivery range.");
  }

  // 2. 校验成功，获取 ruleId 并创建订单
  const ruleId = checkResult.ruleId as number;
  const newOrder = await OrderRepository.createOrder(data, ruleId);

  return newOrder;
}

// ----------------------------------------------------------------------
// P2.2 Service: 查询订单详情
// ----------------------------------------------------------------------

/**
 * 根据 ID 查询订单详情。
 * @param orderId 订单 ID
 * @param merchantId 商家 ID (用于权限过滤)
 * @returns 订单实体
 */
export async function getOrderDetails(
  orderId: string,
  merchantId: string
): Promise<Order> {
  const order = await OrderRepository.findOrderById(orderId, merchantId);

  if (!order) {
    // 抛出业务错误，Controller 层负责将其转换为 404 Not Found
    throw new Error(`Order ID ${orderId} not found.`);
  }
  return order;
}

/**
 * 根据复杂的筛选条件获取分页订单列表。
 */
export async function findOrdersList(
  queryParams: OrderListQueryDTO
): Promise<PaginatedOrderList> {
  // 确保分页参数有合理的默认值
  const defaults: OrderListQueryDTO = { page: 1, pageSize: 20 };
  const finalParams = { ...defaults, ...queryParams };

  // 调用 Repository，传入 merchantId (MOCK_MERCHANT_ID)
  return await OrderRepository.findOrdersByFilter(
    finalParams,
    MOCK_MERCHANT_ID
  );
}

// 追踪正在进行 Mock 配送的定时器
const activeMockDeliveries = new Map<string, NodeJS.Timeout>();

// ----------------------------------------------------------------------
// 轨迹 Mock 逻辑
// ----------------------------------------------------------------------

/**
 * 启动一个订单的 Mock 配送轨迹推送。
 * @param orderId 订单ID
 * @param merchantId 商家ID
 * @param destinationCoords 目的地坐标
 * @param ruleId 传入的规则ID，用于控制推送速度
 */
export async function startMockDelivery(
  orderId: string,
  merchantId: string,
  destinationCoords: Coordinates,
  ruleId: number // 接收 ruleId
) {
  if (activeMockDeliveries.has(orderId)) {
    clearInterval(activeMockDeliveries.get(orderId));
  }

  // 动态获取推送间隔
  const interval = getIntervalByRuleId(ruleId);

  let step = 0;
  const totalSteps = MOCK_ROUTE_POINTS.length;

  // ... (simulateMovement 函数体保持不变) ...
  const simulateMovement = async () => {
    // ... (省略内部逻辑，确保使用 interval 变量) ...
    if (step >= totalSteps) {
      clearInterval(timer);
      activeMockDeliveries.delete(orderId);
      console.log(`[MOCK] 订单 ${orderId} 轨迹推送结束。`);
      await OrderRepository.checkAndAutoUpdateStatus(orderId, merchantId);
      return;
    }

    // ... (更新位置和检查到达的逻辑保持不变) ...
    const currentCoords = MOCK_ROUTE_POINTS[step];

    try {
      await OrderRepository.updateOrderLocation(
        orderId,
        merchantId,
        currentCoords
      );
      const isArrived = await OrderRepository.checkAndAutoUpdateStatus(
        orderId,
        merchantId,
        50
      );

      if (isArrived) {
        console.log(`[MOCK] 订单 ${orderId} 状态自动变更为 'arrived'！`);
        clearInterval(timer);
        activeMockDeliveries.delete(orderId);
      }
    } catch (error) {
      console.error(`[MOCK ERROR] 订单 ${orderId} 推送失败:`, error);
      clearInterval(timer);
      activeMockDeliveries.delete(orderId);
    }

    step++;
  };

  // 使用动态计算的 interval
  const timer = setInterval(simulateMovement, interval);
  activeMockDeliveries.set(orderId, timer);

  console.log(
    `[MOCK] 订单 ${orderId} (Rule ${ruleId}) 开始模拟配送，间隔: ${interval}ms...`
  );
}

// ----------------------------------------------------------------------
// 订单发货逻辑
// ----------------------------------------------------------------------

interface StartShippingInput {
  orderId: string;
  merchantId: string;
  ruleId: number;
  routePath: Coordinates[];
}

export async function startShipping(input: StartShippingInput): Promise<Order> {
  const { orderId, merchantId, ruleId, routePath } = input;

  // 1. 调用 Repository 更新数据库
  const updatedRow = await OrderRepository.startShippingOrder(
    orderId,
    merchantId,
    {
      ruleId,
      routePath,
    }
  );

  // 2. 将数据库行映射回业务 Order 模型
  const updatedOrder = mapRowToOrder(updatedRow);

  // 注意：位置推送现在由独立的 Mock Logistics 服务处理
  // Mock Logistics 服务会定期检查 shipping 状态的订单并开始推送位置
  // 不需要在这里调用 startMockDelivery

  return updatedOrder;
}

// ----------------------------------------------------------------------
// 辅助函数：根据 ruleId 确定 Mock 推送间隔 (毫秒)
// ----------------------------------------------------------------------

/**
 * 根据 ruleId 映射推送间隔，模拟不同配送方式的速度。
 * @param ruleId 时效规则ID
 * @returns 推送间隔（毫秒）
 */
function getIntervalByRuleId(ruleId: number): number {
  return ruleId * 1000; // 简单映射：ruleId 乘以 1000 毫秒
}

/**
 * 用户确认收货，完成订单。
 * @param orderId 订单ID
 * @param userId 模拟用户ID (待加入认证系统后从 request.user 中获取)
 * @returns 最终状态的订单实体
 */
export async function deliverOrder(
  orderId: string,
  userId: string
): Promise<Order> {
  const completedRow = await OrderRepository.completeDelivery(orderId, userId);

  // 映射并返回 Order
  return mapRowToOrder(completedRow);
}
