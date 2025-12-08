export interface FenceData {
  id: number;
  fenceName?: string;
  fenceDesc?: string;
  ruleId?: number | null; // 关联的时效规则 ID

  // 数据库存储：GEOGRAPHY(Polygon, 4326) 或 GEOGRAPHY(Point, 4326)
  shapeType: "polygon" | "circle";

  // **前端输入的原始坐标数据**
  // 多边形: [[lng, lat], [lng, lat], ...]
  // 圆形: [[lng, lat]]
  coordinates: number[][];

  radius: number; // 圆形半径 (米)

  // 数据库读取时，PostGIS geometry 字段的 GeoJSON 表现
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  geometry?: any;
}

// 数据库返回的原始行类型
export interface FenceRow {
  id: number;
  fence_name: string;
  fence_desc: string;
  rule_id: number;
  shape_type: string;
  radius: number | string; // 数据库可能是 number，但有时会被驱动转换为 string
  geojson_data: string; // PostGIS ST_AsGeoJSON 返回的字段
  // ... 其他数据库字段
}

export interface DeliveryRule {
  id: number;
  name: string;
  logic: number;
}

// 创建和更新时的 DTO
export type CreateFenceDTO = Omit<FenceData, "id" | "geometry">;
export type UpdateFenceDTO = Omit<FenceData, "geometry">;
