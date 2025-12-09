import { query } from "../../config/db.js";
import {
  LogisticsUpdate,
  AbnormalOrder,
  VehicleTrajectory,
  DeliveryLocation,
  DeliveryStatisticsByRegion,
  ProvinceStatistics,
  CityStatistics,
  AverageDeliveryTime,
} from "./dashboard.types.js";
import { OrderStatus } from "../order/order.types.js";
import { Coordinates } from "../../shared/geo.types.js";
import {
  getProvinceByCoordinates,
  getCityByCoordinates,
} from "./dashboard.utils.js";

const MOCK_MERCHANT_ID = "10001";

/**
 * 获取总单数
 */
export async function getTotalOrdersCount(
  merchantId: string = MOCK_MERCHANT_ID
): Promise<number> {
  const sql = `
    SELECT COUNT(*) as count
    FROM orders
    WHERE merchant_id = $1
  `;

  const rows: Array<{ count: string }> = await query(sql, [merchantId]);
  return parseInt(rows[0].count, 10);
}

/**
 * 获取完成率（已完成的订单数 / 总订单数）
 */
export async function getCompletionRate(
  merchantId: string = MOCK_MERCHANT_ID
): Promise<number> {
  const sql = `
    SELECT 
      COUNT(*) FILTER (WHERE status = 'delivered') as completed_count,
      COUNT(*) as total_count
    FROM orders
    WHERE merchant_id = $1
  `;

  const rows: Array<{
    completed_count: string;
    total_count: string;
  }> = await query(sql, [merchantId]);

  const completed = parseInt(rows[0].completed_count, 10);
  const total = parseInt(rows[0].total_count, 10);

  if (total === 0) {
    return 0;
  }

  return Math.round((completed / total) * 100 * 100) / 100; // 保留两位小数
}

/**
 * 获取最近更新的物流动态
 */
export async function getRecentLogisticsUpdates(
  limit: number = 50,
  merchantId: string = MOCK_MERCHANT_ID
): Promise<LogisticsUpdate[]> {
  const sql = `
    SELECT 
      o.id as order_id,
      o.status,
      o.last_update_time,
      ST_AsGeoJSON(o.current_position) as current_position_geojson,
      -- 获取状态变更的文本描述
      CASE 
        WHEN o.status = 'pending' THEN '待处理'
        WHEN o.status = 'pickedUp' THEN '已取件'
        WHEN o.status = 'shipping' THEN '运输中'
        WHEN o.status = 'arrived' THEN '已到达'
        WHEN o.status = 'delivered' THEN '已签收'
        WHEN o.status = 'cancelled' THEN '已取消'
        ELSE o.status
      END as status_text
    FROM orders o
    WHERE o.merchant_id = $1
      AND o.last_update_time IS NOT NULL
      AND o.status IN ('shipping', 'arrived', 'delivered', 'pickedUp')
    ORDER BY o.last_update_time DESC
    LIMIT $2
  `;

  const rows: Array<{
    order_id: string;
    status: OrderStatus;
    last_update_time: Date;
    current_position_geojson?: string | null; // GeoJSON string
    status_text: string;
  }> = await query(sql, [merchantId, limit]);

  return rows.map((row) => {
    let currentPosition: Coordinates | undefined;

    if (row.current_position_geojson) {
      try {
        const geoJson = JSON.parse(row.current_position_geojson);
        if (geoJson.coordinates) {
          currentPosition = geoJson.coordinates as Coordinates;
        }
      } catch (e) {
        // 如果解析失败，跳过当前位置
      }
    }

    return {
      orderId: row.order_id,
      status: row.status,
      statusText: row.status_text,
      updateTime: row.last_update_time.toISOString(),
      currentPosition,
    };
  });
}

/**
 * 检查 abnormal_reason 字段是否存在（带缓存）
 */
let abnormalReasonColumnExists: boolean | null = null;

async function checkAbnormalReasonColumn(): Promise<boolean> {
  if (abnormalReasonColumnExists !== null) {
    return abnormalReasonColumnExists;
  }

  try {
    const checkColumnSql = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name = 'abnormal_reason'
    `;
    const result = await query<{ column_name: string }>(checkColumnSql, []);
    abnormalReasonColumnExists = result.length > 0;
    return abnormalReasonColumnExists;
  } catch (error) {
    // 如果查询失败，假设字段不存在
    abnormalReasonColumnExists = false;
    return false;
  }
}

/**
 * 获取异常订单列表
 */
export async function getAbnormalOrders(
  limit: number = 100,
  merchantId: string = MOCK_MERCHANT_ID
): Promise<AbnormalOrder[]> {
  const columnExists = await checkAbnormalReasonColumn();

  // 根据字段是否存在构建不同的SQL
  const abnormalReasonSelect = columnExists
    ? "o.abnormal_reason,"
    : "NULL::text as abnormal_reason,";

  const sql = `
    SELECT 
      o.id as order_id,
      o.user_id,
      o.recipient_name,
      o.recipient_address,
      o.status,
      ${abnormalReasonSelect}
      o.create_time,
      o.last_update_time,
      -- 计算异常持续时间（秒）
      CASE 
        WHEN o.last_update_time IS NOT NULL THEN
          EXTRACT(EPOCH FROM (NOW() - o.last_update_time))
        ELSE
          EXTRACT(EPOCH FROM (NOW() - o.create_time))
      END as abnormal_duration
    FROM orders o
    WHERE o.merchant_id = $1
      AND o.is_abnormal = true
    ORDER BY 
      CASE 
        WHEN o.last_update_time IS NOT NULL THEN o.last_update_time
        ELSE o.create_time
      END DESC
    LIMIT $2
  `;

  const rows: Array<{
    order_id: string;
    user_id: string;
    recipient_name: string;
    recipient_address: string;
    status: OrderStatus;
    abnormal_reason: string | null;
    create_time: Date;
    last_update_time: Date | null;
    abnormal_duration: number;
  }> = await query(sql, [merchantId, limit]);

  return rows.map((row) => ({
    orderId: row.order_id,
    userId: row.user_id,
    recipientName: row.recipient_name,
    recipientAddress: row.recipient_address,
    status: row.status,
    abnormalReason: row.abnormal_reason || "未知异常",
    createTime: row.create_time.toISOString(),
    lastUpdateTime: row.last_update_time
      ? row.last_update_time.toISOString()
      : undefined,
    abnormalDuration: Math.round(row.abnormal_duration),
  }));
}

/**
 * 获取所有车辆的轨迹（正在配送的订单）
 */
export async function getVehicleTrajectories(
  merchantId: string = MOCK_MERCHANT_ID
): Promise<VehicleTrajectory[]> {
  const sql = `
    SELECT 
      o.id as order_id,
      o.status,
      o.route_path,
      o.current_position,
      o.recipient_coords,
      o.last_update_time,
      -- 将route_path转换为GeoJSON
      CASE 
        WHEN o.route_path IS NULL THEN NULL
        ELSE ST_AsGeoJSON(o.route_path)
      END as route_path_geojson,
      -- 将current_position转换为GeoJSON
      ST_AsGeoJSON(o.current_position) as current_position_geojson,
      -- 将recipient_coords转换为GeoJSON
      ST_AsGeoJSON(o.recipient_coords) as recipient_coords_geojson
    FROM orders o
    WHERE o.merchant_id = $1
      AND o.status IN ('shipping', 'arrived', 'pickedUp')
      AND o.route_path IS NOT NULL
    ORDER BY o.last_update_time DESC NULLS LAST
  `;

  const rows: Array<{
    order_id: string;
    status: OrderStatus;
    route_path: unknown;
    current_position: unknown;
    recipient_coords: unknown;
    last_update_time: Date | null;
    route_path_geojson: string | null;
    current_position_geojson: string | null;
    recipient_coords_geojson: string;
  }> = await query(sql, [merchantId]);

  return rows.map((row) => {
    // 解析规划路径
    let routePath: Coordinates[] = [];
    if (row.route_path_geojson) {
      try {
        const geoJson = JSON.parse(row.route_path_geojson);
        if (
          geoJson.type === "LineString" &&
          Array.isArray(geoJson.coordinates)
        ) {
          routePath = geoJson.coordinates as Coordinates[];
        }
      } catch (e) {
        console.error(
          `Failed to parse route_path for order ${row.order_id}:`,
          e
        );
      }
    }

    // 解析当前位置
    let currentPosition: Coordinates | undefined;
    if (row.current_position_geojson) {
      try {
        const geoJson = JSON.parse(row.current_position_geojson);
        if (geoJson.coordinates) {
          currentPosition = geoJson.coordinates as Coordinates;
        }
      } catch (e) {
        // 如果解析失败，跳过当前位置
      }
    }

    // 解析目的地坐标
    let destination: Coordinates = [0, 0];
    if (row.recipient_coords_geojson) {
      try {
        const geoJson = JSON.parse(row.recipient_coords_geojson);
        if (geoJson.coordinates) {
          destination = geoJson.coordinates as Coordinates;
        }
      } catch (e) {
        console.error(
          `Failed to parse recipient_coords for order ${row.order_id}:`,
          e
        );
      }
    }

    // 计算已走过的路径（从起点到当前位置）
    let traveledPath: Coordinates[] = [];
    if (routePath.length > 0 && currentPosition) {
      // 找到最接近当前位置的路径点
      let nearestIndex = 0;
      let minDistance = Infinity;

      for (let i = 0; i < routePath.length; i++) {
        const distance = calculateDistance(routePath[i], currentPosition!);
        if (distance < minDistance) {
          minDistance = distance;
          nearestIndex = i;
        }
      }

      // 返回从起点到最近点的所有路径点（包含最近点）
      traveledPath = routePath.slice(0, nearestIndex + 1);
    }

    return {
      orderId: row.order_id,
      status: row.status,
      routePath,
      traveledPath,
      currentPosition,
      destination,
      lastUpdateTime: row.last_update_time
        ? row.last_update_time.toISOString()
        : undefined,
    };
  });
}

/**
 * 获取收货位置坐标（用于热力图）
 * 聚合相同或相近位置的订单数量
 */
export async function getDeliveryLocations(
  merchantId: string = MOCK_MERCHANT_ID
): Promise<DeliveryLocation[]> {
  // 使用PostGIS的ST_ClusterWithin来聚合相近的点
  // 这里我们简化处理，直接返回所有收货位置，前端可以自行聚合
  const sql = `
    SELECT 
      ST_AsGeoJSON(o.recipient_coords) as recipient_coords_geojson,
      COUNT(*) as order_count,
      MAX(o.create_time) as last_delivery_time
    FROM orders o
    WHERE o.merchant_id = $1
      AND o.status = 'delivered'
    GROUP BY o.recipient_coords
    ORDER BY order_count DESC
  `;

  const rows: Array<{
    recipient_coords_geojson: string;
    order_count: string;
    last_delivery_time: Date;
  }> = await query(sql, [merchantId]);

  return rows.map((row) => {
    let coordinates: Coordinates = [0, 0];
    try {
      const geoJson = JSON.parse(row.recipient_coords_geojson);
      if (geoJson.coordinates) {
        coordinates = geoJson.coordinates as Coordinates;
      }
    } catch (e) {
      console.error("Failed to parse recipient_coords_geojson:", e);
    }

    return {
      coordinates,
      orderCount: parseInt(row.order_count, 10),
      lastDeliveryTime: row.last_delivery_time.toISOString(),
    };
  });
}

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
 * 获取分省/分市收货数量统计
 */
export async function getDeliveryStatisticsByRegion(
  merchantId: string = MOCK_MERCHANT_ID
): Promise<DeliveryStatisticsByRegion> {
  // 获取所有已完成的订单及其坐标
  const sql = `
    SELECT 
      ST_AsGeoJSON(o.recipient_coords) as recipient_coords_geojson,
      COUNT(*) as order_count
    FROM orders o
    WHERE o.merchant_id = $1
      AND o.status = 'delivered'
    GROUP BY o.recipient_coords
  `;

  const rows: Array<{
    recipient_coords_geojson: string;
    order_count: string;
  }> = await query(sql, [merchantId]);

  // 解析坐标并统计
  const provinceMap = new Map<
    string,
    { count: number; coords: Coordinates[] }
  >();
  const cityMap = new Map<
    string,
    { count: number; coords: Coordinates[]; province: string }
  >();
  const coordinateLevel: DeliveryLocation[] = [];

  for (const row of rows) {
    let coordinates: Coordinates = [0, 0];
    try {
      const geoJson = JSON.parse(row.recipient_coords_geojson);
      if (geoJson.coordinates) {
        coordinates = geoJson.coordinates as Coordinates;
      }
    } catch (e) {
      continue;
    }

    const orderCount = parseInt(row.order_count, 10);

    // 经纬度级别
    coordinateLevel.push({
      coordinates,
      orderCount,
    });

    // 省份级别统计
    const province = getProvinceByCoordinates(coordinates);
    if (!provinceMap.has(province)) {
      provinceMap.set(province, { count: 0, coords: [] });
    }
    const provinceData = provinceMap.get(province)!;
    provinceData.count += orderCount;
    provinceData.coords.push(coordinates);

    // 城市级别统计
    const city = getCityByCoordinates(coordinates);
    const cityKey = `${province}-${city}`;
    if (!cityMap.has(cityKey)) {
      cityMap.set(cityKey, {
        count: 0,
        coords: [],
        province,
      });
    }
    const cityData = cityMap.get(cityKey)!;
    cityData.count += orderCount;
    cityData.coords.push(coordinates);
  }

  // 转换为返回格式
  const byProvince: ProvinceStatistics[] = Array.from(
    provinceMap.entries()
  ).map(([province, data]) => {
    // 计算省份中心坐标（所有坐标的平均值）
    const centerLng =
      data.coords.reduce((sum, c) => sum + c[0], 0) / data.coords.length;
    const centerLat =
      data.coords.reduce((sum, c) => sum + c[1], 0) / data.coords.length;

    return {
      province,
      orderCount: data.count,
      centerCoordinates: [centerLng, centerLat],
    };
  });

  const byCity: CityStatistics[] = Array.from(cityMap.entries()).map(
    ([cityKey, data]) => {
      const city = cityKey.split("-")[1];
      // 计算城市中心坐标
      const centerLng =
        data.coords.reduce((sum, c) => sum + c[0], 0) / data.coords.length;
      const centerLat =
        data.coords.reduce((sum, c) => sum + c[1], 0) / data.coords.length;

      return {
        province: data.province,
        city,
        orderCount: data.count,
        centerCoordinates: [centerLng, centerLat],
      };
    }
  );

  return {
    byProvince: byProvince.sort((a, b) => b.orderCount - a.orderCount),
    byCity: byCity.sort((a, b) => b.orderCount - a.orderCount),
    byCoordinates: coordinateLevel,
  };
}

/**
 * 获取平均配送时间统计
 * @param groupBy 分组方式：province（省份）或 month（月份）
 */
export async function getAverageDeliveryTime(
  groupBy: "province" | "month" = "province",
  merchantId: string = MOCK_MERCHANT_ID
): Promise<AverageDeliveryTime[]> {
  let sql: string;

  if (groupBy === "province") {
    // 按省份分组（需要先获取坐标，然后判断省份）
    // 由于数据库中没有省份字段，我们需要先查询所有订单，然后在应用层分组
    sql = `
      SELECT 
        ST_AsGeoJSON(o.recipient_coords) as recipient_coords_geojson,
        EXTRACT(EPOCH FROM (o.last_update_time - o.create_time)) / 3600 as delivery_hours
      FROM orders o
      WHERE o.merchant_id = $1
        AND o.status = 'delivered'
        AND o.last_update_time IS NOT NULL
        AND o.create_time IS NOT NULL
    `;

    const rows: Array<{
      recipient_coords_geojson: string;
      delivery_hours: number | null;
    }> = await query(sql, [merchantId]);

    // 按省份分组计算平均值
    const provinceMap = new Map<
      string,
      { totalHours: number; count: number }
    >();

    for (const row of rows) {
      // 跳过无效的配送时间
      if (
        row.delivery_hours === null ||
        isNaN(row.delivery_hours) ||
        row.delivery_hours < 0
      ) {
        continue;
      }

      let coordinates: Coordinates = [0, 0];
      try {
        const geoJson = JSON.parse(row.recipient_coords_geojson);
        if (geoJson.coordinates) {
          coordinates = geoJson.coordinates as Coordinates;
        }
      } catch (e) {
        continue;
      }

      const province = getProvinceByCoordinates(coordinates);
      if (!provinceMap.has(province)) {
        provinceMap.set(province, { totalHours: 0, count: 0 });
      }
      const data = provinceMap.get(province)!;
      data.totalHours += row.delivery_hours;
      data.count += 1;
    }

    return Array.from(provinceMap.entries()).map(([province, data]) => {
      const avgHours = data.count > 0 ? data.totalHours / data.count : 0;
      return {
        groupKey: province,
        groupType: "province" as const,
        averageHours: Math.round(avgHours * 100) / 100,
        averageMinutes: Math.round(avgHours * 60 * 100) / 100,
        orderCount: data.count,
      };
    });
  } else {
    // 按月份分组
    sql = `
      SELECT 
        TO_CHAR(o.create_time, 'YYYY-MM') as month_key,
        AVG(EXTRACT(EPOCH FROM (o.last_update_time - o.create_time)) / 3600) as avg_hours,
        COUNT(*) as order_count
      FROM orders o
      WHERE o.merchant_id = $1
        AND o.status = 'delivered'
        AND o.last_update_time IS NOT NULL
        AND o.create_time IS NOT NULL
      GROUP BY TO_CHAR(o.create_time, 'YYYY-MM')
      ORDER BY month_key DESC
    `;

    const rows: Array<{
      month_key: string;
      avg_hours: number | null;
      order_count: string;
    }> = await query(sql, [merchantId]);

    return rows
      .filter((row) => row.avg_hours !== null && !isNaN(row.avg_hours))
      .map((row) => {
        const avgHours = row.avg_hours || 0;
        return {
          groupKey: row.month_key,
          groupType: "month" as const,
          averageHours: Math.round(avgHours * 100) / 100,
          averageMinutes: Math.round(avgHours * 60 * 100) / 100,
          orderCount: parseInt(row.order_count, 10),
        };
      });
  }
}
