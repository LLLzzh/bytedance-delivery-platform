import { query } from "../config/db.js";
import { OrderStatus } from "../types/order.types.js";
import { config } from "../config/config.js";

/**
 * 异常检测配置
 */
interface AnomalyConfig {
  // 从创建到发货的最大时间（毫秒），默认 2 小时
  maxPendingTime: number;
  // 从发货到到达的最大时间（毫秒），默认 4 小时
  maxShippingTime: number;
  // 位置更新间隔的最大时间（毫秒），默认 5 分钟（如果超过这个时间没有更新，可能异常）
  maxPositionUpdateGap: number;
}

const DEFAULT_ANOMALY_CONFIG: AnomalyConfig = {
  maxPendingTime: 2 * 60 * 60 * 1000, // 2 小时
  maxShippingTime: 4 * 60 * 60 * 1000, // 4 小时
  maxPositionUpdateGap: 5 * 60 * 1000, // 5 分钟
};

/**
 * 异常检测服务
 * 负责检测订单异常并更新数据库
 */
export class AnomalyDetector {
  private checkInterval: NodeJS.Timeout | null = null;
  private abnormalReasonColumnExists: boolean | null = null; // 缓存字段存在性检查结果;
  private config: AnomalyConfig;

  constructor(anomalyConfig?: Partial<AnomalyConfig>) {
    this.config = { ...DEFAULT_ANOMALY_CONFIG, ...anomalyConfig };
  }

  /**
   * 检测所有订单的异常情况
   */
  async checkAllOrders(): Promise<void> {
    try {
      // 检查 pending 状态的订单（超过最大待处理时间）
      await this.checkPendingOrders();

      // 检查 shipping 状态的订单（超过最大配送时间或位置更新间隔过长）
      await this.checkShippingOrders();
    } catch (error) {
      console.error("[AnomalyDetector] Error checking orders:", error);
    }
  }

  /**
   * 检查 abnormal_reason 字段是否存在（带缓存）
   */
  private async checkAbnormalReasonColumn(): Promise<boolean> {
    if (this.abnormalReasonColumnExists !== null) {
      return this.abnormalReasonColumnExists;
    }

    try {
      const checkColumnSql = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'abnormal_reason'
      `;
      this.abnormalReasonColumnExists =
        (await query(checkColumnSql, [])).length > 0;
      return this.abnormalReasonColumnExists;
    } catch (error) {
      // 如果查询失败，假设字段不存在
      this.abnormalReasonColumnExists = false;
      return false;
    }
  }

  /**
   * 检查 pending 状态的订单
   */
  private async checkPendingOrders(): Promise<void> {
    const columnExists = await this.checkAbnormalReasonColumn();

    const reason = `订单待处理时间超过 ${this.config.maxPendingTime / 1000 / 60} 分钟`;
    const maxPendingSeconds = this.config.maxPendingTime / 1000;

    let sql: string;
    let params: (string | OrderStatus | number)[];

    if (columnExists) {
      sql = `
        UPDATE orders
        SET 
          is_abnormal = true,
          abnormal_reason = $1,
          last_update_time = NOW()
        WHERE 
          status = $2
          AND is_abnormal = false
          AND EXTRACT(EPOCH FROM (NOW() - create_time)) > $3
      `;
      params = [reason, OrderStatus.Pending, maxPendingSeconds];
    } else {
      // 如果字段不存在，只更新 is_abnormal
      sql = `
        UPDATE orders
        SET 
          is_abnormal = true,
          last_update_time = NOW()
        WHERE 
          status = $1
          AND is_abnormal = false
          AND EXTRACT(EPOCH FROM (NOW() - create_time)) > $2
      `;
      params = [OrderStatus.Pending, maxPendingSeconds];
    }

    const result = await query(sql, params);
    if (result.length > 0) {
      console.log(
        `[AnomalyDetector] Marked ${result.length} pending orders as abnormal`
      );
    }
  }

  /**
   * 检查 shipping 状态的订单
   */
  private async checkShippingOrders(): Promise<void> {
    const columnExists = await this.checkAbnormalReasonColumn();

    // 检查配送时间过长（从状态变为 shipping 开始计算）
    // 注意：这里需要找到订单状态变为 shipping 的时间，但数据库中没有这个字段
    // 所以我们使用 last_update_time 作为近似值（订单发货时会更新 last_update_time）
    const reason1 = `配送时间超过 ${this.config.maxShippingTime / 1000 / 60} 分钟`;
    const maxShippingSeconds = this.config.maxShippingTime / 1000;

    let sql1: string;
    let params1: (string | OrderStatus | number)[];

    if (columnExists) {
      sql1 = `
        UPDATE orders
        SET 
          is_abnormal = true,
          abnormal_reason = $1,
          last_update_time = NOW()
        WHERE 
          status = $2
          AND is_abnormal = false
          AND last_update_time IS NOT NULL
          AND EXTRACT(EPOCH FROM (NOW() - last_update_time)) > $3
      `;
      params1 = [reason1, OrderStatus.Shipping, maxShippingSeconds];
    } else {
      sql1 = `
        UPDATE orders
        SET 
          is_abnormal = true,
          last_update_time = NOW()
        WHERE 
          status = $1
          AND is_abnormal = false
          AND last_update_time IS NOT NULL
          AND EXTRACT(EPOCH FROM (NOW() - last_update_time)) > $2
      `;
      params1 = [OrderStatus.Shipping, maxShippingSeconds];
    }

    const result1 = await query(sql1, params1);
    if (result1.length > 0) {
      console.log(
        `[AnomalyDetector] Marked ${result1.length} shipping orders as abnormal (timeout)`
      );
    }

    // 检查位置更新间隔过长（可能卡住了）
    const reason2 = `位置更新间隔超过 ${this.config.maxPositionUpdateGap / 1000 / 60} 分钟，可能异常`;
    const maxGapSeconds = this.config.maxPositionUpdateGap / 1000;

    let sql2: string;
    let params2: (string | OrderStatus | number)[];

    if (columnExists) {
      sql2 = `
        UPDATE orders
        SET 
          is_abnormal = true,
          abnormal_reason = $1,
          last_update_time = NOW()
        WHERE 
          status = $2
          AND is_abnormal = false
          AND last_update_time IS NOT NULL
          AND EXTRACT(EPOCH FROM (NOW() - last_update_time)) > $3
      `;
      params2 = [reason2, OrderStatus.Shipping, maxGapSeconds];
    } else {
      sql2 = `
        UPDATE orders
        SET 
          is_abnormal = true,
          last_update_time = NOW()
        WHERE 
          status = $1
          AND is_abnormal = false
          AND last_update_time IS NOT NULL
          AND EXTRACT(EPOCH FROM (NOW() - last_update_time)) > $2
      `;
      params2 = [OrderStatus.Shipping, maxGapSeconds];
    }

    const result2 = await query(sql2, params2);
    if (result2.length > 0) {
      console.log(
        `[AnomalyDetector] Marked ${result2.length} shipping orders as abnormal (position gap)`
      );
    }
  }

  /**
   * 启动异常检测循环
   */
  start(): void {
    if (this.checkInterval) {
      return;
    }

    this.checkInterval = setInterval(async () => {
      await this.checkAllOrders();
    }, config.anomalyCheckInterval);

    console.log(
      `[AnomalyDetector] Started anomaly detection loop (interval: ${config.anomalyCheckInterval}ms)`
    );
  }

  /**
   * 停止异常检测循环
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log("[AnomalyDetector] Stopped anomaly detection loop");
    }
  }
}
