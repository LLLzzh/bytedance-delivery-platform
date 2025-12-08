// src/modules/fence/fence.repository.ts

import { query } from "../../config/db.js";
import { createGeographyExpression } from "../../utils/geo.utils.js";
import { FenceData, CreateFenceDTO, FenceRow } from "./fence.types.js";

// ----------------------------------------------------------------------
// 辅助函数：将数据库行转换为 TS 模型
// ----------------------------------------------------------------------

/**
 * 将数据库的原始行数据（包括 PostGIS 几何字段）转换为 FenceData 模型。
 * 假设数据库查询使用了 ST_AsGeoJSON(geometry) AS geojson_data
 */
function mapRowToFenceData(row: FenceRow): FenceData {
  // 假设 PostGIS 查询结果已将 geometry 作为一个 GeoJSON 字符串返回
  const geometryObj = row.geojson_data ? JSON.parse(row.geojson_data) : null;

  // 坐标还原逻辑：从 GeoJSON 对象的 coordinates 属性中提取坐标
  let coordinates: number[][] = [];

  if (geometryObj && geometryObj.coordinates) {
    if (row.shape_type === "polygon") {
      // 对于多边形，GeoJSON 格式是 [[[...]]] 或 [[...]]，取最外层数组
      // 取第一个数组作为多边形的外部环
      const coords = geometryObj.coordinates;
      if (
        Array.isArray(coords) &&
        coords.length > 0 &&
        Array.isArray(coords[0])
      ) {
        coordinates = coords[0];
      }
    } else if (row.shape_type === "circle") {
      // 对于点（圆心），GeoJSON 格式是 [...]，我们用一个数组包裹
      coordinates = [geometryObj.coordinates];
    }
  }

  return {
    id: row.id,
    fenceName: row.fence_name,
    fenceDesc: row.fence_desc,
    ruleId: row.rule_id,
    shapeType: row.shape_type,
    radius: parseFloat(row.radius as string), // 确保是 number 类型
    coordinates: coordinates, // 从 GeoJSON 转换得到
    // geometry: geometryObj // 仅用于内部调试
  } as FenceData;
}

// ----------------------------------------------------------------------
// CRUD: CREATE
// ----------------------------------------------------------------------

export async function createFence(
  data: CreateFenceDTO,
  merchantId: string
): Promise<FenceData> {
  const { fenceName, fenceDesc, ruleId, shapeType, coordinates, radius } = data;

  // 核心：将 TS 坐标转换为 PostGIS GEOGRAPHY 表达式 (例如 'ST_GeomFromText(...)' )
  const geographyExpression = createGeographyExpression(shapeType, coordinates);

  const sql = `
        INSERT INTO fences (
            merchant_id, fence_name, fence_desc, rule_id, shape_type, radius, geometry
        ) VALUES (
            $1, $2, $3, $4, $5, $6, ${geographyExpression}
        )
        RETURNING 
            id, fence_name, fence_desc, rule_id, shape_type, radius, 
            ST_AsGeoJSON(geometry) AS geojson_data;
    `;

  const params = [
    merchantId, // $1
    fenceName, // $2
    fenceDesc, // $3
    ruleId, // $4
    shapeType, // $5
    radius, // $6
    // ❌ 移除 JSON.stringify(coordinates)
  ];

  // 🔥🔥🔥 DEBUG SQL 🔥🔥🔥
  console.log("--- DEBUG SQL ---");
  console.log("SQL:", sql);
  console.log("Params:", params);
  console.log("-----------------");

  const rows: FenceRow[] = await query(sql, params);
  if (rows.length === 0) {
    throw new Error("Fence creation failed.");
  }

  return mapRowToFenceData(rows[0]);
}

// ----------------------------------------------------------------------
// CRUD: READ (获取所有围栏)
// ----------------------------------------------------------------------

export async function findAllFences(merchantId: string): Promise<FenceData[]> {
  const sql = `
        SELECT 
            f.id, f.fence_name, f.fence_desc, f.rule_id, f.shape_type, f.radius,
            -- 使用 PostGIS 函数将 GEOGRAPHY 字段转换为 GeoJSON 格式，便于 TS 处理
            ST_AsGeoJSON(f.geometry) AS geojson_data
        FROM fences f
        WHERE f.merchant_id = $1
        ORDER BY f.id;
    `;

  const rows = await query(sql, [merchantId]);
  return rows.map(mapRowToFenceData);
}

// ----------------------------------------------------------------------
// CRUD: DELETE
// ----------------------------------------------------------------------

export async function deleteFence(
  fenceId: number,
  merchantId: string
): Promise<boolean> {
  const sql = `
        DELETE FROM fences
        WHERE id = $1 AND merchant_id = $2;
    `;

  const result = await query(sql, [fenceId, merchantId]);
  // 检查 DELETE 操作是否影响了行数
  return result.rowCount > 0;
}

// ----------------------------------------------------------------------
// CRUD: READ (根据 ID 获取单个围栏)
// ----------------------------------------------------------------------

export async function findFenceById(
  fenceId: number,
  merchantId: string
): Promise<FenceData | null> {
  const sql = `
        SELECT 
            f.id, f.fence_name, f.fence_desc, f.rule_id, f.shape_type, f.radius,
            ST_AsGeoJSON(f.geometry) AS geojson_data
        FROM fences f
        WHERE f.id = $1 AND f.merchant_id = $2;
    `;

  const rows: FenceRow[] = await query(sql, [fenceId, merchantId]);

  if (rows.length === 0) {
    return null;
  }

  return mapRowToFenceData(rows[0]);
}

// ----------------------------------------------------------------------
// CRUD: UPDATE
// ----------------------------------------------------------------------

export async function updateFence(
  fenceId: number,
  data: CreateFenceDTO,
  merchantId: string
): Promise<FenceData | null> {
  const { fenceName, fenceDesc, ruleId, shapeType, coordinates, radius } = data;

  // 核心：将 TS 坐标转换为 PostGIS GEOGRAPHY 表达式
  const geographyExpression = createGeographyExpression(shapeType, coordinates);

  const sql = `
        UPDATE fences SET
            fence_name = $1,
            fence_desc = $2,
            rule_id = $3,
            shape_type = $4,
            radius = $5,
            geometry = ${geographyExpression}, -- 使用前面生成的 PostGIS 几何表达式
            updated_at = CURRENT_TIMESTAMP
        WHERE 
            id = $6 AND merchant_id = $7
        RETURNING 
            id, fence_name, fence_desc, rule_id, shape_type, radius, 
            ST_AsGeoJSON(geometry) AS geojson_data;
    `;

  const params = [
    fenceName, // $1
    fenceDesc, // $2
    ruleId, // $3
    shapeType, // $4
    radius, // $5
    // ❌ 移除 JSON.stringify(coordinates)
    fenceId, // $6
    merchantId, // $7
  ];

  const rows: FenceRow[] = await query(sql, params);

  if (rows.length === 0) {
    // 如果没有行被更新，说明 ID 或 merchantId 不匹配
    return null;
  }

  return mapRowToFenceData(rows[0]);
}
