# 后端全流程测试指南

本文档说明如何测试从发货开始到收货完成的完整后端流程。

## 前置条件

### 1. 启动所有服务

确保以下服务都在运行：

```bash
# 1. 启动数据库（如果使用 Docker）
docker-compose -f docker-compose.dev.yml up -d

# 2. 启动 API 服务（终端 1）
cd apps/api
pnpm dev

# 3. 启动 Worker 服务（终端 2）
cd apps/worker
pnpm dev

# 4. 启动 Mock Logistics 服务（终端 3）
cd apps/mock-logistics
pnpm dev
```

### 2. 检查服务状态

```bash
# 检查 API 服务
curl http://localhost:3000/health

# 检查 Worker 服务
curl http://localhost:3001/health
```

### 3. 确保数据库已初始化

确保数据库中已有配送围栏（fences）和配送规则（delivery_rules）数据，否则无法创建订单。

---

## 测试流程

### 方式一：使用自动化测试脚本（推荐）

#### 1. 运行完整流程测试

```bash
# 给脚本添加执行权限
chmod +x scripts/test-delivery-flow.sh

# 运行测试
./scripts/test-delivery-flow.sh
```

脚本会自动执行以下步骤：

1. ✅ 检查服务状态
2. ✅ 创建订单
3. ✅ 订单发货
4. ✅ 等待 Mock Logistics 推送位置
5. ✅ 查询订单详情和路径
6. ✅ 检查订单状态变更
7. ✅ 用户确认收货

#### 2. 测试 WebSocket 实时追踪

```bash
# 首先获取一个已发货的订单 ID（从上面的测试脚本输出中获取）
ORDER_ID="your-order-id-here"

# 运行 WebSocket 测试
node scripts/test-websocket.js $ORDER_ID
```

---

### 方式二：手动测试

#### 步骤 1: 创建订单

```bash
curl -X POST http://localhost:3000/api/v1/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "d74823ab-1234-4a2a-b9c2-9e909a7b746c",
    "merchantId":"10001",
    "amount": 299.00,
    "recipientName": "测试用户",
    "recipientAddress": "北京市朝阳区测试地址",
    "recipientCoords": [116.3974, 39.9093]
  }'
```

**响应示例**：

```json
{
  "success": true,
  "order": {
    "id": "xxx-xxx-xxx",
    "status": "pending",
    ...
  }
}
```

**保存订单 ID**：`ORDER_ID="xxx-xxx-xxx"`

---

#### 步骤 2: 订单发货

```bash
curl -X POST http://localhost:3000/api/v1/orders/ddcde663-f8e5-474e-ae09-39b80f429e7f/ship \
  -H "Content-Type: application/json" \
  -d '{
    "ruleId": 102,
    "routePath": [
     [116.48, 39.995],
  [116.481, 39.996],
  [116.482, 39.9965],
  [116.483, 39.997],
  [116.484, 39.9975],
  [116.485, 39.998],
  [116.486, 39.9985],
  [116.487, 39.999],
  [116.488, 39.9995],
  [116.489, 39.9998],
  [116.49, 40.0],
  [116.491, 40.0002],
  [116.492, 40.0005],
  [116.493, 40.001],
  [116.494, 40.0015],
  [116.495, 40.002],
  [116.496, 40.0025],
  [116.497, 40.003],
  [116.498, 40.0035],
  [116.499, 40.004],
  [116.5, 40.0045],
  [116.5, 40.005]
    ]
  }'
```

**响应示例**：

```json
{
  "success": true,
  "message": "Order shipped successfully with Rule ID 2. Tracking started.",
  "data": {
    "order": {
      "id": "xxx-xxx-xxx",
      "status": "shipping",
      ...
    }
  }
}
```

**关键点**：

- ✅ 订单状态已更新为 `shipping`
- ✅ 路径已存储到数据库
- ✅ Mock Logistics 服务会在 30 秒内检测到新订单并开始推送位置

---

#### 步骤 3: 等待并检查位置更新

**等待 Mock Logistics 检测订单**（最多 30 秒）：

```bash
# 等待 35 秒
sleep 35

# 查询订单详情
curl http://localhost:3000/api/v1/orders/d74823ab-1234-4a2a-b9c2-9e909a7b746c
```

**检查点**：

- ✅ `currentPosition` 字段应该有值
- ✅ `lastUpdateTime` 应该已更新
- ✅ `traveledPath` 应该包含已走过的路径点

**查看路径历史**：

```bash
curl http://localhost:3000/api/v1/orders/${ORDER_ID}/path
```

---

#### 步骤 4: 测试 WebSocket 实时追踪

**在新终端中运行**：

```bash
node scripts/test-websocket.js ${ORDER_ID}
```

**预期行为**：

1. ✅ 连接成功后收到 `connected` 消息
2. ✅ 定期收到 `position_update` 消息（根据 ruleId 的推送间隔）
3. ✅ 当订单到达收货地址时，收到 `status_update` 消息（status: `arrived`）

**WebSocket 消息示例**：

```json
// 连接确认
{
  "type": "connected",
  "orderId": "xxx-xxx-xxx",
  "timestamp": "2024-01-01T00:00:00.000Z"
}

// 位置更新
{
  "type": "position_update",
  "orderId": "xxx-xxx-xxx",
  "coordinates": [116.3975, 39.9094],
  "timestamp": "2024-01-01T00:00:01.000Z"
}

// 状态变更（到达）
{
  "type": "status_update",
  "orderId": "xxx-xxx-xxx",
  "status": "arrived",
  "message": "包裹已到达，请准备收货",
  "timestamp": "2024-01-01T00:05:00.000Z"
}
```

---

#### 步骤 5: 检查订单状态自动变更

**等待订单到达收货地址**（根据路径长度和推送速度，可能需要几分钟）：

```bash
# 定期查询订单状态
watch -n 2 "curl -s http://localhost:3000/api/v1/orders/${ORDER_ID} | jq '.order.status'"
```

**或者手动查询**：

```bash
curl http://localhost:3000/api/v1/orders/${ORDER_ID} | jq '.order.status'
```

**预期**：

- ✅ 当车辆位置接近收货地址（距离 < 100米）时，状态自动变为 `arrived`
- ✅ 如果已建立 WebSocket 连接，会收到 `status_update` 消息

---

#### 步骤 6: 用户确认收货

```bash
curl -X POST http://localhost:3000/api/v1/orders/${ORDER_ID}/deliver
```

**响应示例**：

```json
{
  "success": true,
  "message": "Order xxx-xxx-xxx successfully marked as delivered.",
  "data": {
    "order": {
      "id": "xxx-xxx-xxx",
      "status": "delivered",
      ...
    }
  }
}
```

**检查点**：

- ✅ 订单状态已更新为 `delivered`
- ✅ 如果 WebSocket 连接存在，会收到 `status_update` 消息（status: `delivered`）

---

## 测试检查清单

### ✅ 发货流程

- [ ] 订单创建成功（status: `pending`）
- [ ] 发货接口调用成功（status: `shipping`）
- [ ] 路径数据已存储到数据库

### ✅ Mock Logistics 服务

- [ ] 服务检测到新的 `shipping` 订单
- [ ] 开始按照路径推送位置更新
- [ ] 位置更新频率符合 ruleId 配置

### ✅ Worker 服务

- [ ] 接收到位置推送
- [ ] 数据库中的 `current_position` 已更新
- [ ] `last_update_time` 已更新
- [ ] WebSocket 客户端收到位置更新消息

### ✅ 自动状态变更

- [ ] 订单到达收货地址时，状态自动变为 `arrived`
- [ ] WebSocket 客户端收到状态变更通知

### ✅ 用户确认收货

- [ ] 确认收货接口调用成功（status: `delivered`）
- [ ] WebSocket 客户端收到状态变更通知

### ✅ 路径历史

- [ ] `traveledPath` 字段正确计算（从起点到当前位置）
- [ ] 路径历史接口返回正确的数据

---

## 常见问题排查

### 1. Mock Logistics 没有推送位置

**检查**：

- ✅ Mock Logistics 服务是否运行
- ✅ 数据库中订单状态是否为 `shipping`
- ✅ 订单是否有 `route_path` 数据
- ✅ 查看 Mock Logistics 服务日志

**解决**：

```bash
# 查看 Mock Logistics 日志
cd apps/mock-logistics
# 检查控制台输出，应该看到 "Loaded X shipping orders"
```

### 2. Worker 服务没有收到位置推送

**检查**：

- ✅ Worker 服务是否运行
- ✅ `WORKER_URL` 环境变量是否正确
- ✅ 查看 Worker 服务日志

**解决**：

```bash
# 查看 Worker 服务日志
cd apps/worker
# 检查是否有错误信息
```

### 3. WebSocket 连接失败

**检查**：

- ✅ Worker 服务是否运行在 3001 端口
- ✅ 订单 ID 是否正确
- ✅ 网络连接是否正常

**解决**：

```bash
# 测试 Worker 服务健康检查
curl http://localhost:3001/health

# 查看 WebSocket 连接统计
curl http://localhost:3001/stats
```

### 4. 订单状态没有自动变为 `arrived`

**检查**：

- ✅ 车辆位置是否接近收货地址（距离 < 100米）
- ✅ Worker 服务是否正常运行
- ✅ 查看 Worker 服务日志

**解决**：

```bash
# 手动检查距离
# 在 Worker 服务的 location-receiver.ts 中，到达阈值是 100 米
# 确保路径的最后一个点接近收货地址
```

---

## 性能测试

### 测试多个订单并发

```bash
# 创建多个订单并同时发货
for i in {1..10}; do
  # 创建订单
  ORDER_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/orders ...)
  ORDER_ID=$(echo $ORDER_RESPONSE | jq -r '.order.id')

  # 发货
  curl -X POST http://localhost:3000/api/v1/orders/${ORDER_ID}/ship ...

  echo "订单 ${i} 已发货: ${ORDER_ID}"
done
```

### 测试 WebSocket 连接数

```bash
# 查看当前连接数
curl http://localhost:3001/stats
```

---

## 调试技巧

### 1. 查看数据库中的订单数据

```sql
-- 连接到数据库
psql -h localhost -U postgres -d mydb

-- 查看订单状态和位置
SELECT
  id,
  status,
  ST_AsText(current_position) as current_position,
  ST_AsText(recipient_coords) as recipient_coords,
  last_update_time
FROM orders
WHERE id = 'your-order-id';
```

### 2. 查看服务日志

所有服务都会在控制台输出日志，关注以下关键信息：

- **API 服务**：订单创建、发货、收货的日志
- **Worker 服务**：位置接收、状态变更、WebSocket 推送的日志
- **Mock Logistics 服务**：订单检测、位置推送的日志

### 3. 使用 Postman 或 curl 测试

可以使用 Postman 导入以下接口进行测试：

1. `POST /api/v1/orders` - 创建订单
2. `POST /api/v1/orders/:id/ship` - 发货
3. `GET /api/v1/orders/:id` - 查询订单
4. `GET /api/v1/orders/:id/path` - 查询路径
5. `POST /api/v1/orders/:id/deliver` - 确认收货

---

## 总结

完整的测试流程包括：

1. ✅ **创建订单** → 状态：`pending`
2. ✅ **订单发货** → 状态：`shipping`，路径存储
3. ✅ **Mock Logistics 推送位置** → 位置更新，WebSocket 推送
4. ✅ **自动到达** → 状态：`arrived`，WebSocket 通知
5. ✅ **用户确认收货** → 状态：`delivered`，WebSocket 通知

使用自动化测试脚本可以快速验证整个流程，手动测试可以更详细地检查每个步骤。
