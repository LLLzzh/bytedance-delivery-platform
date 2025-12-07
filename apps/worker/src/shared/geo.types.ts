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
