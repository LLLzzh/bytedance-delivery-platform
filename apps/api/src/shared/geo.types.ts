/**
 * 标准地理坐标类型：[经度, 纬度]
 * PostGIS 标准：POINT(经度 纬度)
 */
export type Coordinates = [number, number];

/**
 * PostGIS 核心几何类型 - 点 (Point)
 */
export interface GeoPoint {
  type: "Point";
  coordinates: Coordinates;
}

/**
 * 路线/轨迹类型 (LineString)
 * GEOGRAPHY(LineString, 4326)
 */
export type RoutePath = Coordinates[];

/**
 * 几何信息 DTO (Data Transfer Object)
 * 用于数据库查询返回时，将 ST_AsGeoJSON 转换成这个格式。
 */
export interface GeoFeature {
  id: string; // 唯一标识符
  geometry: GeoPoint;
  properties: { [key: string]: unknown }; // 任何额外的属性
}

// 定义 MQ 中传输的消息体结构
// Topic: "location.report"
export interface LocationReportMessage {
  orderId: string;
  coordinates: Coordinates;
  timestamp: number;
  status: "shipping" | "arrived"; // 模拟器当前的状态
}
