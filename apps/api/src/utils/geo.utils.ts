import { Coordinates } from "../shared/geo.types";

// SRID (Spatial Reference System Identifier) - 4326 是 WGS 84 坐标系
const SRID = 4326;

/**
 * 辅助函数：将 TS 的 [lng, lat] 转换为 PostGIS 的 POINT WKT 格式。
 * 格式: POINT(lng lat)
 */
export function coordsToPointWKT(coords: Coordinates): string {
  // PostGIS 标准: POINT(经度 纬度)
  return `POINT(${coords[0]} ${coords[1]})`;
}

/**
 * 辅助函数：将 TS 的多边形坐标数组转换为 PostGIS 的 POLYGON WKT 格式。
 * 格式: POLYGON((lng1 lat1, lng2 lat2, ..., lng1 lat1))
 * * 注意：WKT 格式要求多边形是闭合的（首尾坐标必须相同）。
 */
export function coordsToPolygonWKT(coordinates: number[][]): string {
  // 确保多边形闭合
  const isClosed =
    coordinates[0][0] === coordinates[coordinates.length - 1][0] &&
    coordinates[0][1] === coordinates[coordinates.length - 1][1];

  let path = coordinates;
  if (!isClosed) {
    // 如果没有闭合，将第一个点添加到末尾
    path = [...coordinates, coordinates[0]];
  }

  // 格式化为 "lng1 lat1, lng2 lat2, ..."
  const wktCoords = path.map((coord) => `${coord[0]} ${coord[1]}`).join(", ");

  // 完整格式：POLYGON((...))
  return `POLYGON((${wktCoords}))`;
}

/**
 * 核心转换函数：根据围栏类型，将前端数据转换为 PostGIS GEOGRAPHY 表达式。
 * * @param shapeType 'polygon' 或 'circle'
 * @param coordinates 坐标数组
 * @returns 完整的 SQL 片段: ST_GeomFromText('WKT_STRING', 4326)
 */
export function createGeographyExpression(
  shapeType: "polygon" | "circle",
  coordinates: number[][]
): string {
  if (shapeType === "polygon") {
    const polygonWKT = coordsToPolygonWKT(coordinates);
    // 使用 ST_MakeValid() 尝试修复可能存在的几何体自相交问题
    return `ST_MakeValid(ST_GeomFromText('${polygonWKT}', ${SRID}))::geography`;
  }

  if (shapeType === "circle") {
    // 数据库中，我们只存储圆心点
    const centerCoords = coordinates[0];
    if (!centerCoords) {
      throw new Error(
        "Circle shape requires at least one coordinate (center point)."
      );
    }
    const pointWKT = coordsToPointWKT(centerCoords);
    return `ST_GeomFromText('${pointWKT}', ${SRID})::geography`;
  }

  throw new Error(`Unsupported shape type: ${shapeType}`);
}

/**
 * 将 RoutePath (Coordinates[]) 转换为 PostGIS 的 LINESTRING WKT 表达式。
 * @param routePath 坐标数组
 * @returns WKT 字符串
 */
export function routePathToLineStringWKT(routePath: Coordinates[]): string {
  const pathWKT = routePath.map((c) => `${c[0]} ${c[1]}`).join(",");
  return `LINESTRING(${pathWKT})`;
}

/**
 * 将 WKT 表达式转换为 PostGIS GeomFromText 调用
 * @param wkt WKT 字符串
 * @returns SQL 片段
 */
export function wrapWKTToGeomFromText(wkt: string): string {
  return `ST_GeomFromText('${wkt}', ${SRID})::geography`;
}
