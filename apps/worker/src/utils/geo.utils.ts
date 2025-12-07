import { Coordinates } from "../shared/geo.types.js";

const SRID = 4326;

/**
 * 将 TS 的 [lng, lat] 转换为 PostGIS 的 POINT WKT 格式。
 */
export function coordsToPointWKT(coords: Coordinates): string {
  return `POINT(${coords[0]} ${coords[1]})`;
}

/**
 * 将 RoutePath (Coordinates[]) 转换为 PostGIS 的 LINESTRING WKT 表达式。
 */
export function routePathToLineStringWKT(routePath: Coordinates[]): string {
  const pathWKT = routePath.map((c) => `${c[0]} ${c[1]}`).join(",");
  return `LINESTRING(${pathWKT})`;
}

/**
 * 将 WKT 表达式转换为 PostGIS GeomFromText 调用
 */
export function wrapWKTToGeomFromText(wkt: string): string {
  return `ST_GeomFromText('${wkt}', ${SRID})::geography`;
}
