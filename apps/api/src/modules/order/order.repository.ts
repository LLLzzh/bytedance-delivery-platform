// src/modules/order/order.repository.ts

import { query } from "../../config/db.js";
import { Coordinates } from "../../shared/geo.types.js";
import {
  DeliveryCheckResult,
  CreateOrderDTO,
  Order,
  OrderStatus,
  OrderListQueryDTO,
  PaginatedOrderList,
  OrderRow,
  CountRow,
  OrderStatistics,
  AnomalyType,
} from "./order.types.js";
import {
  setOrderAnomalyType,
  getOrderAnomalyType,
} from "../../config/redis.js";
import {
  coordsToPointWKT,
  wrapWKTToGeomFromText,
  routePathToLineStringWKT,
} from "../../utils/geo.utils.js";

const MOCK_MERCHANT_ID = "10001";
const SRID = 4326;

// 排序字段的白名单映射：TS 字段名 -> 数据库列名
const SORT_COLUMN_MAP: Record<string, string> = {
  createTime: "create_time", // 默认排序字段
  amount: "amount",
  status: "status",
  recipientName: "recipient_name",
};

// ----------------------------------------------------------------------
// P2.1 核心：配送范围校验
// ----------------------------------------------------------------------

/**
 * 检查给定坐标是否在任何一个配送围栏内。
 * @param coords 收货地址坐标 [lng, lat]
 * @returns DeliveryCheckResult
 */
export async function checkDeliveryRange(
  coords: Coordinates
): Promise<DeliveryCheckResult> {
  // 生成收货点 Point 的 WKT 表达式
  const recipientPointWKT = coordsToPointWKT(coords);

  const sql = `
        SELECT 
            f.rule_id,
            f.radius
        FROM fences f
        WHERE f.merchant_id = $2
        AND (
            -- Case 1: 多边形围栏 (shape_type = 'polygon')
            -- ST_Covers 适用于 GEOGRAPHY 类型
            (f.shape_type = 'polygon' AND ST_Covers(f.geometry, ST_GeomFromText($1, ${SRID})::geography)) 
            
            OR
            
            -- Case 2: 圆形围栏 (shape_type = 'circle')
            (f.shape_type = 'circle' AND ST_DWithin(
                f.geometry, 
                ST_GeomFromText($1, ${SRID})::geography, 
                f.radius
            ))
        )
        LIMIT 1;
    `;

  // 注意：fences 表的 RETURNING 字段可能和 OrderRow 不完全匹配，但我们只取 rule_id
  const rows: { rule_id: number }[] = await query(sql, [
    recipientPointWKT,
    MOCK_MERCHANT_ID,
  ]);

  if (rows.length > 0) {
    return {
      isDeliverable: true,
      ruleId: rows[0].rule_id, // 返回匹配到的规则ID
    };
  }

  return {
    isDeliverable: false,
    ruleId: null,
  };
}

// ----------------------------------------------------------------------
// 辅助函数：将数据库行转换为 Order 模型
// ----------------------------------------------------------------------

/**
 * 计算两点之间的距离（米）- 使用 Haversine 公式
 */
function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
  const R = 6371000; // 地球半径（米）
  const lat1 = (coord1[1] * Math.PI) / 180;
  const lat2 = (coord2[1] * Math.PI) / 180;
  const deltaLat = ((coord2[1] - coord1[1]) * Math.PI) / 180;
  const deltaLon = ((coord2[0] - coord1[0]) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * 计算已走过的路径点（从 routePath 起点到 currentPosition 之间的所有点）
 */
function calculateTraveledPath(
  routePath: Coordinates[] | undefined,
  currentPosition: Coordinates | undefined
): Coordinates[] | undefined {
  if (!routePath || routePath.length === 0) {
    return undefined;
  }

  // 如果没有当前位置，返回空数组
  if (!currentPosition) {
    return [];
  }

  // 找到最接近当前位置的路径点索引
  let nearestIndex = 0;
  let minDistance = Infinity;

  for (let i = 0; i < routePath.length; i++) {
    const distance = calculateDistance(routePath[i], currentPosition);
    if (distance < minDistance) {
      minDistance = distance;
      nearestIndex = i;
    }
  }

  // 返回从起点到最近点的所有路径点（包含最近点）
  return routePath.slice(0, nearestIndex + 1);
}

/**
 * 将异常类型转换为中文异常原因
 */
function getAbnormalReasonFromAnomalyType(
  anomalyType: string | null
): string | undefined {
  if (!anomalyType || anomalyType === "none") {
    return undefined;
  }

  const reasonMap: Record<string, string> = {
    routeDeviation: "轨迹偏移超过 5 公里",
    longTimeStopped: "长时间轨迹不动",
    longTimeNoUpdate: "位置更新间隔超过 5 分钟，可能异常",
  };

  return reasonMap[anomalyType] || "订单出现异常情况";
}

export function mapRowToOrder(row: OrderRow, abnormalReason?: string): Order {
  // 解析 GEOGRAPHY 坐标
  const recipientCoordsGeoJSON = row.recipient_coords_geojson
    ? JSON.parse(row.recipient_coords_geojson)
    : null;
  const currentPositionGeoJSON = row.current_position_geojson
    ? JSON.parse(row.current_position_geojson)
    : null;

  // 解析 RoutePath (依赖 route_path_geojson 字段)
  const routePathGeoJSON = row.route_path_geojson
    ? JSON.parse(row.route_path_geojson)
    : null;

  const recipientCoords: Coordinates = recipientCoordsGeoJSON?.coordinates || [
    0, 0,
  ];
  const currentPosition: Coordinates | undefined =
    currentPositionGeoJSON?.coordinates;

  let routePath: Coordinates[] | undefined = undefined;

  // 检查是否为有效的 LineString 结构
  if (
    routePathGeoJSON &&
    routePathGeoJSON.type === "LineString" &&
    Array.isArray(routePathGeoJSON.coordinates)
  ) {
    // LineString 的 coordinates 直接就是 [ [lng, lat], ... ] 的数组
    routePath = routePathGeoJSON.coordinates as Coordinates[];
  }

  // 计算已走过的路径点
  const traveledPath = calculateTraveledPath(routePath, currentPosition);

  // ----------------------------------------------------------------------

  // Note: amount 可能是 string 或 number，需要处理
  const amountValue =
    typeof row.amount === "string" ? parseFloat(row.amount) : row.amount;

  return {
    id: row.id,
    userId: row.user_id,
    merchantId: row.merchant_id,
    createTime: row.create_time.toISOString(),
    amount: amountValue,
    status: row.status,
    recipientName: row.recipient_name,
    recipientAddress: row.recipient_address,
    recipientCoords: recipientCoords,
    lastUpdateTime: row.last_update_time
      ? row.last_update_time.toISOString()
      : undefined,
    currentPosition: currentPosition,
    routePath: routePath,
    traveledPath: traveledPath, // 已走过的路径点
    isAbnormal: row.is_abnormal,
    abnormalReason: abnormalReason || undefined, // 异常原因（从 Redis 获取）
    ruleId: row.rule_id,
  };
}

// ----------------------------------------------------------------------
// P2.1 订单创建
// ----------------------------------------------------------------------

export async function createOrder(
  data: CreateOrderDTO,
  ruleId: number
): Promise<Order> {
  const {
    userId,
    amount,
    recipientName,
    recipientAddress,
    recipientCoords,
    merchantId,
    anomalyType = AnomalyType.None,
  } = data;

  // 1. 生成收货点 Point 的 WKT 表达式
  const recipientPointWKT = coordsToPointWKT(recipientCoords);

  // 2. 插入订单数据（不存储异常类型到数据库）
  const sql = `
        INSERT INTO orders (
            id, user_id, merchant_id, amount, status, rule_id, recipient_name, recipient_address, recipient_coords
        ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, ${wrapWKTToGeomFromText(recipientPointWKT)}
        )
        RETURNING
            *, 
            -- 转换为 GeoJSON，便于 TS 解析坐标
            ST_AsGeoJSON(recipient_coords) AS recipient_coords_geojson,
            -- current_position 在创建时为空，可以直接返回 NULL
            ST_AsGeoJSON(current_position) AS current_position_geojson,
            -- route_path 在创建时为空，可以直接返回 NULL
            ST_AsGeoJSON(route_path) AS route_path_geojson;
    `;

  const params = [
    userId, // $1
    merchantId, // $2
    amount, // $3
    OrderStatus.Pending, // $4
    ruleId, // $5
    recipientName, // $6
    recipientAddress, // $7
  ];

  const rows: OrderRow[] = await query(sql, params);

  if (rows.length === 0) {
    throw new Error("Order creation failed.");
  }

  const order = mapRowToOrder(rows[0]);

  // 3. 如果设置了异常类型，存储到 Redis（供 mock-logistics 读取）
  if (anomalyType !== AnomalyType.None) {
    try {
      await setOrderAnomalyType(order.id, anomalyType);
      console.log(
        `[OrderRepository] Stored anomaly type ${anomalyType} for order ${order.id} in Redis`
      );
    } catch (error) {
      // Redis 连接失败不影响订单创建，只记录日志
      console.warn(
        `[OrderRepository] Failed to store anomaly type in Redis:`,
        error
      );
    }
  }

  // 4. 返回 Order
  return order;
}

// ----------------------------------------------------------------------
// P2.2 订单查询 (修正了别名和 route_path 处理)
// ----------------------------------------------------------------------

export async function findOrderById(
  orderId: string,
  merchantId: string
): Promise<Order | null> {
  const sql = `
        SELECT 
            o.*, -- 使用别名 o
            ST_AsGeoJSON(o.recipient_coords) AS recipient_coords_geojson,
            ST_AsGeoJSON(o.current_position) AS current_position_geojson,
            CASE 
                WHEN o.route_path IS NULL 
                THEN NULL 
                ELSE ST_AsGeoJSON(o.route_path) 
            END AS route_path_geojson
        FROM orders o -- 引入表别名 o
        WHERE o.id = $1 AND o.merchant_id = $2;
    `;

  const rows: OrderRow[] = await query(sql, [orderId, merchantId]);

  if (rows.length === 0) {
    return null;
  }

  // 从 Redis 获取异常类型并转换为异常原因
  let abnormalReason: string | undefined = undefined;
  try {
    const anomalyType = await getOrderAnomalyType(orderId);
    abnormalReason = getAbnormalReasonFromAnomalyType(anomalyType);
  } catch (error) {
    console.warn(
      `[OrderRepository] Failed to get anomaly type from Redis for order ${orderId}:`,
      error
    );
  }

  return mapRowToOrder(rows[0], abnormalReason);
}

/**
 * 根据复杂的筛选条件获取分页订单列表。
 * @param queryParams 包含分页、筛选和搜索关键词
 * @returns PaginatedOrderList
 */
export async function findOrdersByFilter(
  queryParams: OrderListQueryDTO,
  merchantId: string
): Promise<PaginatedOrderList> {
  const {
    page,
    pageSize,
    userId,
    status,
    searchQuery,
    sortBy = "createTime",
    sortDirection = "DESC",
  } = queryParams;

  // 1. 初始化基础 SQL 和参数
  const whereClauses: string[] = ["o.merchant_id = $1"]; // 商家 ID 总是第一个参数，使用别名 o
  const params: (string | number)[] = [merchantId];
  let paramIndex = 2; // 后续参数从 $2 开始

  // 2. 构建动态 WHERE 条件 (确保使用 o. 别名)

  // 2A. 用户 ID 筛选
  if (userId) {
    whereClauses.push(`o.user_id = $${paramIndex++}`);
    params.push(userId);
  }

  // 2B. 状态筛选
  if (status) {
    const statuses = status.split(",");
    if (statuses.length > 1) {
      const placeholders = statuses
        .map((_, i) => `$${paramIndex + i}`)
        .join(", ");
      whereClauses.push(`o.status IN (${placeholders})`);
      statuses.forEach((s) => params.push(s.trim()));
      paramIndex += statuses.length;
    } else {
      whereClauses.push(`o.status = $${paramIndex++}`);
      params.push(status);
    }
  }

  // 2C. 搜索 (模糊匹配姓名或地址)
  if (searchQuery) {
    // 使用 ILIKE (不区分大小写的 LIKE)
    whereClauses.push(
      `(o.recipient_name ILIKE $${paramIndex} OR o.recipient_address ILIKE $${paramIndex})`
    );
    params.push(`%${searchQuery}%`); // 模糊搜索需要百分号
    paramIndex++;
  }

  // 3. 构建完整的 WHERE 子句
  const whereCondition =
    whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";

  // 4. 执行总数查询 (修正 FROM 子句，引入 o 别名)
  const countSql = `SELECT COUNT(*) FROM orders o ${whereCondition};`; // 引入别名 o
  const countRows: CountRow[] = await query(countSql, params);
  const totalCount = parseInt(countRows[0].count, 10);

  const dbSortColumn = SORT_COLUMN_MAP[sortBy];
  if (!dbSortColumn) {
    // 如果传入了不允许排序的字段，抛出错误
    throw new Error(`Invalid sort column: ${sortBy}`);
  }

  // 4B. 方向校验
  const finalSortDirection =
    sortDirection.toUpperCase() === "ASC" ? "ASC" : "DESC";

  // 5. 执行数据查询 (修正 SELECT 和 FROM 子句)
  const offset = (page - 1) * pageSize;

  const dataSql = `
        SELECT 
            o.*, -- 修正：SELECT o.*
            ST_AsGeoJSON(o.recipient_coords) AS recipient_coords_geojson,
            ST_AsGeoJSON(o.current_position) AS current_position_geojson,
            CASE 
                WHEN o.route_path IS NULL 
                THEN NULL 
                ELSE ST_AsGeoJSON(o.route_path) 
            END AS route_path_geojson
        FROM orders o -- 修正：FROM orders o
        ${whereCondition}
        ORDER BY o.${dbSortColumn} ${finalSortDirection}  -- <<<< 排序逻辑
        LIMIT $${paramIndex++} 
        OFFSET $${paramIndex++};
    `;

  params.push(pageSize);
  params.push(offset);

  const dataRows: OrderRow[] = await query(dataSql, params);

  // 6. 批量从 Redis 获取异常类型并转换为异常原因
  const orders = await Promise.all(
    dataRows.map(async (row) => {
      let abnormalReason: string | undefined = undefined;
      try {
        const anomalyType = await getOrderAnomalyType(row.id);
        abnormalReason = getAbnormalReasonFromAnomalyType(anomalyType);
      } catch (error) {
        console.warn(
          `[OrderRepository] Failed to get anomaly type from Redis for order ${row.id}:`,
          error
        );
      }
      return mapRowToOrder(row, abnormalReason);
    })
  );

  // 6. 返回分页结果
  return {
    orders: orders,
    totalCount: totalCount,
    currentPage: page,
    pageSize: pageSize,
  };
}

// ----------------------------------------------------------------------
// P3.1 订单发货 (修正了 RETURNING 子句)
// ----------------------------------------------------------------------

interface ShippingData {
  ruleId: number;
  routePath: Coordinates[];
}

export async function startShippingOrder(
  orderId: string,
  merchantId: string,
  shippingData: ShippingData
): Promise<OrderRow> {
  const { ruleId, routePath } = shippingData;

  // 转换为 PostGIS WKT 格式的 LINESTRING
  const lineStringWKT = routePathToLineStringWKT(routePath);

  // SQL 语句
  const sql = `
        UPDATE orders o -- 引入别名 o，方便在 RETURNING 中引用
        SET 
            status = $3,
            rule_id = $4,           
            route_path = ${wrapWKTToGeomFromText(lineStringWKT)},
            last_update_time = NOW()
        WHERE o.id = $1 AND o.merchant_id = $2 AND o.status = '${OrderStatus.Pending}' 
        RETURNING 
        o.*, -- 修正：返回 o.*
        ST_AsGeoJSON(o.recipient_coords) AS recipient_coords_geojson,
        ST_AsGeoJSON(o.current_position) AS current_position_geojson,
        CASE 
            WHEN o.route_path IS NULL 
            THEN NULL 
            ELSE ST_AsGeoJSON(o.route_path) 
        END AS route_path_geojson
    `;

  const rows = await query<OrderRow>(sql, [
    orderId, // $1
    merchantId, // $2
    OrderStatus.Shipping, // $3
    ruleId, // $4
  ]);

  if (rows.length === 0) {
    throw new Error("Order not found or status is not pending.");
  }

  return rows[0];
}

// ----------------------------------------------------------------------
// P3.2 订单追踪与状态变更 (修正了 RETURNING 子句)
// ----------------------------------------------------------------------

export async function updateOrderLocation(
  orderId: string,
  merchantId: string,
  coords: Coordinates
): Promise<OrderRow> {
  const currentPointWKT = coordsToPointWKT(coords);

  const sql = `
        UPDATE orders o -- 引入别名 o
        SET 
            current_position = ${wrapWKTToGeomFromText(currentPointWKT)},
            last_update_time = NOW()
        WHERE o.id = $1 AND o.merchant_id = $2
        RETURNING 
            o.*,
            ST_AsGeoJSON(o.recipient_coords) AS recipient_coords_geojson,
            ST_AsGeoJSON(o.current_position) AS current_position_geojson,
            CASE 
                WHEN o.route_path IS NULL 
                THEN NULL 
                ELSE ST_AsGeoJSON(o.route_path) 
            END AS route_path_geojson
    `;

  const rows = await query<OrderRow>(sql, [orderId, merchantId]);

  if (rows.length === 0) {
    throw new Error("Order not found or merchant ID mismatch.");
  }

  return rows[0];
}

export async function checkAndAutoUpdateStatus(
  orderId: string,
  merchantId: string,
  threshold: number = 100
): Promise<boolean> {
  const sql = `
        UPDATE orders
        SET 
            status = '${OrderStatus.Arrived}',
            last_update_time = NOW()
        FROM (
            SELECT 1 
            FROM orders o
            WHERE o.id = $1 
              AND o.merchant_id = $2
              AND o.status = '${OrderStatus.Shipping}'
              -- 核心 PostGIS 检查：距离是否在阈值内
              AND ST_DWithin(o.current_position, o.recipient_coords, $3)
        ) AS subquery
        WHERE orders.id = $1 AND orders.merchant_id = $2
        RETURNING orders.id;
    `;

  // $3 参数是 threshold (米)
  const rows = await query<OrderRow>(sql, [orderId, merchantId, threshold]);

  return rows.length > 0;
}

/**
 * 将订单状态从 'arrived' 变更为 'delivered' (用户确认收货)。
 * @param orderId 订单ID
 * @param userId 用户ID (用于权限验证)
 * @returns 更新后的 OrderRow
 */
export async function completeDelivery(
  orderId: string,
  userId: string
): Promise<OrderRow> {
  // SQL 语句：更新状态，设置最后更新时间，并确保旧状态是 'arrived'
  const sql = `
        UPDATE orders o 
        SET 
            status = $3,
            last_update_time = NOW()
        WHERE o.id = $1 AND o.user_id = $2 AND o.status = '${OrderStatus.Arrived}' 
        RETURNING 
            o.*, 
            ST_AsGeoJSON(o.recipient_coords) AS recipient_coords_geojson,
            ST_AsGeoJSON(o.current_position) AS current_position_geojson,
            CASE 
                WHEN o.route_path IS NULL 
                THEN NULL 
                ELSE ST_AsGeoJSON(o.route_path) 
            END AS route_path_geojson
    `;

  const rows = await query<OrderRow>(sql, [
    orderId, // $1
    userId, // $2
    OrderStatus.Delivered, // $3
  ]);

  if (rows.length === 0) {
    // 订单未找到，或用户ID不匹配，或状态不是 'arrived'
    throw new Error(
      "Order not found, user mismatch, or status is not arrived."
    );
  }

  return rows[0];
}

// ----------------------------------------------------------------------
// 订单统计查询
// ----------------------------------------------------------------------

/**
 * 获取订单统计信息（待发货、运输中、已完成、总交易额）
 * @param merchantId 商家ID
 * @returns OrderStatistics
 */
export async function getOrderStatistics(
  merchantId: string
): Promise<OrderStatistics> {
  const sql = `
    SELECT 
      COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
      COUNT(*) FILTER (WHERE status IN ('shipping', 'pickedUp', 'arrived')) AS shipping_count,
      COUNT(*) FILTER (WHERE status = 'delivered') AS completed_count,
      COALESCE(SUM(amount), 0) AS total_gmv
    FROM orders
    WHERE merchant_id = $1;
  `;

  const rows: Array<{
    pending_count: string;
    shipping_count: string;
    completed_count: string;
    total_gmv: string | number;
  }> = await query(sql, [merchantId]);

  const row = rows[0];

  return {
    pendingCount: parseInt(row.pending_count, 10),
    shippingCount: parseInt(row.shipping_count, 10),
    completedCount: parseInt(row.completed_count, 10),
    totalGMV:
      typeof row.total_gmv === "string"
        ? parseFloat(row.total_gmv)
        : row.total_gmv,
  };
}
