import { query } from "../../config/db"; // 假设你的数据库查询函数
import { Coordinates } from "../../shared/geo.types.js";

export interface MerchantConfigResult {
  merchantId: string;
  location: Coordinates; // [lng, lat]
}

const MOCK_MERCHANT_ID = "10001";

/**
 * 获取商家配置，包括中心点坐标。
 */
export async function getMerchantConfig(): Promise<MerchantConfigResult | null> {
  const sql = `
        SELECT 
            id AS merchant_id,
            -- 将 GEOGRAPHY(Point) 转换为 GeoJSON 字符串
            ST_AsGeoJSON(center_location) AS geojson_location
        FROM merchants
        WHERE id = $1;
    `;

  type DBRow = { merchant_id: string; geojson_location: string | null };
  const rows = (await query(sql, [MOCK_MERCHANT_ID])) as DBRow[];

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  const geometryObj = row.geojson_location
    ? (JSON.parse(row.geojson_location) as {
        type: string;
        coordinates: [number, number];
      })
    : null;

  // GeoJSON Point 格式: {"type":"Point", "coordinates":[lng, lat]}
  const location: Coordinates = geometryObj?.coordinates || [0, 0];

  return {
    merchantId: row.merchant_id,
    location: location,
  };
}
