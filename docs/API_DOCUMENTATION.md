# API 接口文档

## 目录

1. [订单相关接口](#订单相关接口)
2. [WebSocket 实时追踪](#websocket-实时追踪)
3. [Worker 服务接口](#worker-服务接口)

---

## 订单相关接口

### 1. 查询订单详情

**接口说明**：获取订单的详细信息，包括已走过的路径点。此接口**不会建立 WebSocket 连接**，适合页面首次加载时使用。

**请求方式**：`GET`

**请求路径**：`/api/v1/orders/:id`

**路径参数**：

- `id` (string, 必填): 订单ID

**响应示例**：

```json
{
  "success": true,
  "order": {
    "id": "xxx",
    "userId": "xxx",
    "merchantId": "10001",
    "createTime": "2024-01-01T00:00:00.000Z",
    "amount": 299.00,
    "status": "shipping",
    "recipientName": "张三",
    "recipientAddress": "北京市朝阳区xxx",
    "recipientCoords": [116.3974, 39.9093],
    "currentPosition": [116.3970, 39.9090],
    "routePath": [[116.3974, 39.9093], [116.3975, 39.9094], ...], // 完整规划路径
    "traveledPath": [[116.3974, 39.9093], [116.3975, 39.9094]], // 已走过的路径点
    "lastUpdateTime": "2024-01-01T01:00:00.000Z",
    "isAbnormal": false,
    "ruleId": 2,
    "realtimeTracking": false // 标识：此接口不提供实时追踪
  }
}
```

**字段说明**：

- `routePath`: 完整的规划路径（从发货地址到收货地址的所有路径点）
- `traveledPath`: 已走过的路径点（从起点到当前位置之间的所有点）
- `currentPosition`: 当前车辆位置
- `realtimeTracking`: 固定为 `false`，表示此接口不提供实时追踪

**使用场景**：

- 页面首次加载时获取订单基本信息
- 刷新页面时获取最新的路径状态
- 不需要实时追踪时的路径展示

---

### 2. 获取订单路径历史

**接口说明**：专门用于获取订单的路径信息，包括完整路径和已走过的路径点。

**请求方式**：`GET`

**请求路径**：`/api/v1/orders/:id/path`

**路径参数**：

- `id` (string, 必填): 订单ID

**响应示例**：

```json
{
  "success": true,
  "data": {
    "orderId": "xxx",
    "routePath": [[116.3974, 39.9093], [116.3975, 39.9094], ...],
    "traveledPath": [[116.3974, 39.9093], [116.3975, 39.9094]],
    "currentPosition": [116.3970, 39.9090],
    "status": "shipping",
    "lastUpdateTime": "2024-01-01T01:00:00.000Z"
  }
}
```

**使用场景**：

- 需要单独获取路径信息时
- 地图组件需要路径数据时

---

### 3. 用户确认收货

**接口说明**：用户确认收货，将订单状态从 `arrived` 更新为 `delivered`。确认后会自动通过 WebSocket 通知所有订阅该订单的客户端。

**请求方式**：`POST`

**请求路径**：`/api/v1/orders/:id/deliver`

**路径参数**：

- `id` (string, 必填): 订单ID

**请求体**：无

**响应示例**：

```json
{
  "success": true,
  "message": "Order xxx successfully marked as delivered.",
  "data": {
    "order": {
      "id": "xxx",
      "status": "delivered",
      ...
    }
  }
}
```

**状态码**：

- `200`: 成功
- `409`: 订单未找到、用户不匹配或状态不是 `arrived`
- `500`: 服务器错误

**注意事项**：

- 只有状态为 `arrived` 的订单才能确认收货
- 确认收货后，如果客户端已建立 WebSocket 连接，会自动收到状态变更通知

---

## WebSocket 实时追踪

### 连接说明

**重要**：WebSocket 连接会消耗服务器资源，**不应该在页面加载时自动建立**。只有在用户**明确选择查看实时追踪**时才建立连接。

### 连接地址

**Worker 服务地址**：`ws://localhost:3001/ws/:orderId`

**连接参数**：

- `orderId` (string, 必填): 订单ID，作为路径参数

**示例**：

```javascript
const ws = new WebSocket("ws://localhost:3001/ws/ORDER_ID_HERE");
```

### 消息类型

#### 1. 连接确认消息

客户端连接成功后，服务器会立即发送连接确认消息：

```json
{
  "type": "connected",
  "orderId": "xxx",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### 2. 位置更新消息

当订单位置发生变化时，服务器会推送位置更新：

```json
{
  "type": "position_update",
  "orderId": "xxx",
  "coordinates": [116.397, 39.909],
  "timestamp": "2024-01-01T01:00:00.000Z"
}
```

**字段说明**：

- `coordinates`: 当前车辆位置 `[经度, 纬度]`
- `timestamp`: 位置更新时间

**推送频率**：根据配送时效（`ruleId`）动态调整：

- Rule 1 (快速配送): 约 500ms 一次
- Rule 2 (标准配送): 约 1000ms 一次
- Rule 3 (慢速配送): 约 2000ms 一次

#### 3. 状态变更消息

当订单状态发生变化时（如到达、签收），服务器会推送状态变更：

```json
{
  "type": "status_update",
  "orderId": "xxx",
  "status": "arrived",
  "message": "包裹已到达，请准备收货",
  "timestamp": "2024-01-01T02:00:00.000Z"
}
```

**状态值**：

- `arrived`: 包裹已到达收货地址附近（距离 < 100米）
- `delivered`: 用户已确认收货

**消息内容**：

- `arrived`: "包裹已到达，请准备收货"
- `delivered`: "订单已签收"

### 客户端实现示例

```javascript
// 只在用户点击"实时追踪"按钮时建立连接
function startRealtimeTracking(orderId) {
  const ws = new WebSocket(`ws://localhost:3001/ws/${orderId}`);

  ws.onopen = () => {
    console.log("WebSocket 连接已建立");
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    switch (data.type) {
      case "connected":
        console.log("连接确认:", data);
        break;

      case "position_update":
        // 更新地图上的车辆位置
        updateVehiclePosition(data.coordinates);
        // 更新已走过的路径
        addToTraveledPath(data.coordinates);
        break;

      case "status_update":
        // 更新订单状态
        updateOrderStatus(data.status, data.message);
        // 如果是已签收，可以关闭连接
        if (data.status === "delivered") {
          ws.close();
        }
        break;
    }
  };

  ws.onerror = (error) => {
    console.error("WebSocket 错误:", error);
  };

  ws.onclose = () => {
    console.log("WebSocket 连接已关闭");
  };

  // 返回 WebSocket 实例，以便在需要时关闭连接
  return ws;
}

// 用户离开页面或关闭实时追踪时，关闭连接
function stopRealtimeTracking(ws) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.close();
  }
}
```

### 最佳实践

1. **延迟连接**：不要在页面加载时自动建立 WebSocket 连接
2. **用户触发**：只有在用户明确选择"实时追踪"时才建立连接
3. **及时关闭**：用户离开页面或关闭实时追踪功能时，及时关闭连接
4. **错误处理**：实现重连机制和错误提示
5. **降级方案**：如果 WebSocket 连接失败，可以定期轮询 `/api/v1/orders/:id/path` 接口获取最新路径

---

## Worker 服务接口

### 1. 接收位置推送（内部接口）

**接口说明**：Mock Logistics 服务调用此接口推送位置更新。**前端不应直接调用此接口**。

**请求方式**：`POST`

**请求路径**：`/api/v1/location/update`

**请求体**：

```json
{
  "orderId": "xxx",
  "coordinates": [116.397, 39.909],
  "merchantId": "10001" // 可选
}
```

**响应示例**：

```json
{
  "success": true,
  "message": "Location updated and order status changed to arrived" // 可选
}
```

---

### 2. 接收状态变更通知（内部接口）

**接口说明**：API 服务调用此接口通知状态变更。**前端不应直接调用此接口**。

**请求方式**：`POST`

**请求路径**：`/api/v1/status/update`

**请求体**：

```json
{
  "orderId": "xxx",
  "status": "delivered",
  "message": "订单已签收" // 可选
}
```

**响应示例**：

```json
{
  "success": true
}
```

---

### 3. 健康检查

**请求方式**：`GET`

**请求路径**：`/health`

**响应示例**：

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "connections": 5
}
```

---

### 4. 统计信息

**请求方式**：`GET`

**请求路径**：`/stats`

**响应示例**：

```json
{
  "totalConnections": 5
}
```

---

## 完整流程示例

### 场景：用户查看订单详情并开启实时追踪

1. **页面加载**：调用 `GET /api/v1/orders/:id` 获取订单信息和已走过的路径

   ```javascript
   const response = await fetch("/api/v1/orders/ORDER_ID");
   const { order } = await response.json();
   // 使用 order.traveledPath 渲染静态路径
   ```

2. **用户点击"实时追踪"按钮**：建立 WebSocket 连接

   ```javascript
   const ws = startRealtimeTracking("ORDER_ID");
   ```

3. **接收实时更新**：通过 WebSocket 接收位置更新和状态变更

4. **用户离开或关闭追踪**：关闭 WebSocket 连接

   ```javascript
   stopRealtimeTracking(ws);
   ```

5. **用户确认收货**：调用 `POST /api/v1/orders/:id/deliver`
   ```javascript
   const response = await fetch("/api/v1/orders/ORDER_ID/deliver", {
     method: "POST",
   });
   // 如果 WebSocket 连接存在，会自动收到状态变更通知
   ```

---

## 错误处理

### WebSocket 连接错误

- **连接失败**：检查 Worker 服务是否运行，检查网络连接
- **连接断开**：实现自动重连机制（建议最多重试 3 次）
- **消息解析错误**：检查消息格式是否符合文档

### HTTP 接口错误

- **404 Not Found**：订单不存在或 ID 错误
- **409 Conflict**：订单状态不符合操作要求（如确认收货时状态不是 `arrived`）
- **500 Internal Server Error**：服务器内部错误，查看服务器日志

---

## 注意事项

1. **WebSocket 连接管理**：

   - 不要在同一订单上建立多个 WebSocket 连接
   - 及时关闭不再需要的连接
   - 实现连接状态监控

2. **性能优化**：

   - 使用静态路径接口（`GET /api/v1/orders/:id`）作为默认方案
   - 只在必要时建立 WebSocket 连接
   - 考虑使用连接池管理多个订单的追踪

3. **用户体验**：
   - 提供"开启实时追踪"和"关闭实时追踪"的明确按钮
   - 显示连接状态（已连接/已断开）
   - 提供降级方案（WebSocket 失败时使用轮询）
