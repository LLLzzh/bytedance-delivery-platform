/**
 * 发货相关的工具函数
 */

export type Coordinates = [number, number];

/**
 * 清理路线路径数据，确保是纯数组格式
 */
export function cleanRoutePath(path: Coordinates[]): Coordinates[] {
  return path.map((pt) => {
    if (Array.isArray(pt) && pt.length === 2) {
      const lng = Number(pt[0]);
      const lat = Number(pt[1]);

      if (isNaN(lng) || isNaN(lat)) {
        throw new Error(`无效的坐标点: [${pt[0]}, ${pt[1]}]`);
      }

      return [lng, lat] as Coordinates;
    }
    throw new Error(`无效的坐标点格式: ${JSON.stringify(pt)}`);
  });
}

/**
 * 验证路线路径至少包含起点和终点
 */
export function validateRoutePath(path: Coordinates[]): void {
  if (!Array.isArray(path)) {
    throw new Error("路径必须是数组");
  }

  if (path.length < 2) {
    throw new Error("路径至少需要包含起点和终点");
  }
}

/**
 * 高德地图路线对象类型
 */
interface AmapRouteStep {
  path?: Array<{ lng: number; lat: number }>;
}

interface AmapRoute {
  steps?: AmapRouteStep[];
}

/**
 * 从高德地图路线对象中提取坐标数组
 */
export function extractPathFromRoute(route: AmapRoute): Coordinates[] {
  if (!route || !route.steps) {
    throw new Error("无效的路线对象");
  }

  const path: Coordinates[] = [];

  route.steps.forEach((step: AmapRouteStep) => {
    if (step.path && Array.isArray(step.path)) {
      step.path.forEach((p: { lng: number; lat: number }) => {
        if (p && typeof p.lng === "number" && typeof p.lat === "number") {
          path.push([p.lng, p.lat]);
        }
      });
    }
  });

  if (path.length === 0) {
    throw new Error("路线对象中没有有效的路径点");
  }

  return path;
}

/**
 * 准备发货数据，确保是纯 JSON 对象
 */
export function prepareShippingData(
  routePath: Coordinates[],
  ruleId: number
): { ruleId: number; routePath: Coordinates[] } {
  const cleanPath = cleanRoutePath(routePath);
  validateRoutePath(cleanPath);

  return {
    ruleId: Number(ruleId) || 101,
    routePath: cleanPath,
  };
}
