# 配送范围配置 - 后端 API 需求文档

## 1. 概述

前端已经完成了配送范围（电子围栏）的绘制和配置功能。现在需要后端提供 API 来存储这些配置，并基于这些配置实现“判断订单是否在配送范围内”的核心业务逻辑。

## 2. 核心数据结构 (TypeScript 定义)

```typescript
// 围栏数据模型
interface FenceData {
  id?: string | number; // 唯一标识
  fence_name: string; // 围栏名称
  fence_desc: string; // 描述
  rule_id: number | null; // 关联的时效规则 ID (如: 101=60分钟达)
  shape_type: "polygon" | "circle"; // 形状类型

  // 坐标数据
  // 如果是 polygon (多边形): 二维数组 [[lng, lat], [lng, lat], ...]
  // 如果是 circle (圆形): 二维数组，只包含一个中心点 [[lng, lat]]
  coordinates: number[][];

  radius: number; // 圆形半径 (米)，多边形时为 0
}
// 时效规则模型
interface DeliveryRule {
  id: number; // 规则 ID
  name: string; // 规则名称（如: "标准配送"）
  logic: string; // 规则逻辑描述 (如: "60分钟达")
}
```

## 3. API 接口需求

### 3.1 获取商家基础配置

前端地图初始化时，需要知道商家的位置作为地图中心点。

- **接口**: `GET /api/merchant/config`
- **响应**:
  ```json
  {
    "location": [116.397428, 39.90923], // [经度, 纬度]
    "merchant_id": "12345"
  }
  ```

### 3.2 获取时效规则列表

- **接口**: `GET /api/delivery-rules`
- **响应**: `DeliveryRule[]`

### 3.3 围栏管理 (CRUD)

#### 获取围栏列表

- **接口**: `GET /api/fences`
- **响应**: `FenceData[]`

#### 新增围栏

- **接口**: `POST /api/fences`
- **请求体**: `Omit<FenceData, 'id'>`
- **响应**: `FenceData` (带生成的 ID)

#### 更新围栏

- **接口**: `PUT /api/fences/:id`
- **请求体**: `FenceData`
- **响应**: `FenceData`

#### 删除围栏

- **接口**: `DELETE /api/fences/:id`
- **响应**: `200 OK`

---

## 4. 核心业务逻辑实现指南 (给后端的建议)

既然后端使用的是 **Node.js + Fastify + PostgreSQL**，针对“判断订单是否在配送范围内”的逻辑，有以下两种推荐方案：

### 方案 A: 使用纯代码计算 (推荐新手，依赖少)

如果不想折腾数据库插件，可以在 Node.js 代码层进行计算。

1.  **安装工具库**:
    推荐使用 `Turf.js`，这是最流行的地理空间分析库。

    ```bash
    pnpm add @turf/turf
    ```

2.  **判断逻辑**:
    当一个订单产生，或者用户查询“是否可配送”时，后端会收到用户的坐标 `[userLng, userLat]`。

    ```typescript
    import * as turf from "@turf/turf";

    // 假设从数据库取出的围栏列表
    const fences = await getAllFences();
    const userLocation = turf.point([userLng, userLat]);

    for (const fence of fences) {
      let isInside = false;

      if (fence.shape_type === "circle") {
        // 圆形判断：计算距离是否小于半径
        const center = turf.point(fence.coordinates[0]);
        const distance = turf.distance(userLocation, center, {
          units: "meters",
        });
        if (distance <= fence.radius) {
          isInside = true;
        }
      } else {
        // 多边形判断：点是否在多边形内
        // 注意：Turf 要求多边形首尾坐标闭合，如果前端传的没闭合，需要处理一下
        const path = [...fence.coordinates];
        if (
          path[0][0] !== path[path.length - 1][0] ||
          path[0][1] !== path[path.length - 1][1]
        ) {
          path.push(path[0]); // 闭合多边形
        }
        const polygon = turf.polygon([path]);
        if (turf.booleanPointInPolygon(userLocation, polygon)) {
          isInside = true;
        }
      }

      if (isInside) {
        return { canDeliver: true, ruleId: fence.rule_id };
      }
    }

    return { canDeliver: false };
    ```

### 方案 B: 使用 PostGIS (进阶，性能好)

如果数据量很大，建议在 PostgreSQL 中启用 PostGIS 插件。

1.  **数据库存储**: 使用 `GEOMETRY` 或 `GEOGRAPHY` 类型存储围栏。
2.  **查询**: 使用 SQL 直接查询。
    ```sql
    -- 查找包含用户坐标的所有围栏
    SELECT * FROM fences
    WHERE ST_Contains(
      fences.geometry,
      ST_SetSRID(ST_Point(userLng, userLat), 4326)
    );
    ```
