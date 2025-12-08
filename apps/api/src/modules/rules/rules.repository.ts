// src/modules/rule/rule.repository.ts

import { query } from "../../config/db.js";
// 假设 DeliveryRule 类型已定义
import { DeliveryRule } from "../fence/fence.types.js";

/**
 * 获取所有时效规则列表。
 */
export async function findAllDeliveryRules(): Promise<DeliveryRule[]> {
  const sql = `
        SELECT 
            id, name, logic
        FROM delivery_rules
        ORDER BY id;
    `;

  const rows: DeliveryRule[] = await query(sql);

  return rows;
}
