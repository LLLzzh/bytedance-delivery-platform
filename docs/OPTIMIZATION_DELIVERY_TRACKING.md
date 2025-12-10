# 订单轨迹推送优化方案

## 概述

实现了智能推送策略，降低系统开销，提升用户体验：

1. **Mock Logistics 持续推送**：发货后持续推送所有路径点，按 ruleId 确定的间隔推送
2. **Worker 智能推送**：只在有 WebSocket 连接时才推送给前端，否则只更新数据库
3. **前端平滑动画**：接收位置更新后，使用平滑动画渲染小车移动

## 架构设计

### 1. Mock Logistics 服务

**文件**: `apps/mock-logistics/src/services/delivery-simulator.ts`

#### 核心改动

- **持续推送策略**：
  - 发货后持续推送所有路径点
  - 根据 ruleId 确定推送间隔（101: 500ms, 102: 1000ms, 103: 2000ms）
  - 不关心是否有前端连接，持续推送

#### 配置项

**文件**: `apps/mock-logistics/src/config/config.ts`

```typescript
{
  port: 3005,                 // Mock Logistics 服务端口
  positionUpdateInterval: 1000,  // 默认推送间隔（毫秒）
  orderReloadInterval: 30000,    // 订单重新加载间隔（毫秒）
  arrivalThreshold: 100,         // 到达阈值（米）
}
```

### 2. Worker 服务

**文件**: `apps/worker/src/services/location-receiver.ts`

#### 核心改动

- **前端连接检测**：

  - `ordersWithFrontendConnection`: 记录哪些订单有前端连接
  - `notifyFrontendConnected()`: 检测到前端连接时调用
  - `notifyFrontendDisconnected()`: 前端断开连接时调用

- **智能推送策略**：
  - **有前端连接**：更新数据库 + 通过 WebSocket 推送位置更新
  - **无前端连接**：只更新数据库，不推送（降低开销）

**文件**: `apps/worker/src/services/websocket-manager.ts`

#### 核心改动

- **连接状态回调**：

  - `setConnectionCallback()`: 设置前端连接状态变化回调
  - `FrontendConnectionCallback`: 连接/断开回调接口

- **连接管理**：
  - `addConnection()`: 返回是否为第一个连接
  - `removeConnection()`: 返回是否为最后一个连接

### 3. 前端

**文件**: `apps/user/src/pages/TrackingDetail.tsx`

#### 核心改动

- **平滑动画**：

  - `DeliveryMap` 组件已内置 `MarkerMover` 类，使用 `requestAnimationFrame` 实现平滑动画
  - 当 `currentPosition` 更新时，自动使用平滑动画移动到新位置（1秒动画）

- **位置更新处理**：
  - `handlePositionUpdate()`: 接收 WebSocket 位置更新，更新 `currentPosition` 和 `traveledPath`

## 完整流程

```
1. 订单发货
   └─> 订单状态: pending → shipping
   └─> 保存 route_path 和 rule_id

2. Mock Logistics 启动
   └─> 持续推送所有路径点
   └─> 间隔：500ms/1000ms/2000ms（根据 ruleId）
   └─> 推送位置到 Worker 服务

3. Worker 接收位置更新
   ├─> 更新数据库 current_position
   ├─> 检查是否到达收货地址
   └─> 判断是否有前端连接
       ├─> 有连接：通过 WebSocket 推送位置更新（带序列号）
       └─> 无连接：只更新数据库，不推送（降低开销）

4. 用户点击"实时追踪"
   └─> 前端建立 WebSocket 连接
   └─> Worker 检测到连接
   └─> 后续位置更新通过 WebSocket 推送

5. 前端接收并渲染
   └─> 接收位置更新消息
   └─> 按序列号排序处理（确保顺序）
   └─> 更新地图 UI，平滑动画移动小车（1秒动画）
```

## 技术亮点

1. **智能推送策略**：只在有前端连接时才推送，降低无连接时的系统开销
2. **持续推送**：Mock Logistics 持续推送所有路径点，不依赖前端连接状态
3. **平滑动画**：使用 `requestAnimationFrame` 实现小车移动动画，提升用户体验
4. **序列号保证**：确保轨迹点按顺序处理，处理乱序和丢失
5. **解耦设计**：Mock Logistics 和 Worker 服务解耦，职责清晰
6. **可配置性**：支持自定义推送间隔、到达阈值等

## 配置说明

### Mock Logistics 配置

```bash
# .env
PORT=3005                     # Mock Logistics 服务端口
POSITION_UPDATE_INTERVAL=1000 # 默认推送间隔（毫秒）
ORDER_RELOAD_INTERVAL=30000   # 订单重新加载间隔（毫秒）
ARRIVAL_THRESHOLD=100         # 到达阈值（米）
```

### Worker 配置

```bash
# .env
WORKER_PORT=3006              # Worker 服务端口
ARRIVAL_THRESHOLD=100         # 到达阈值（米）
```

## 测试建议

1. **无前端连接测试**：

   - 创建订单并发货
   - 观察数据库 `current_position` 是否持续更新
   - 确认没有前端连接时，WebSocket 不推送（降低开销）

2. **有前端连接测试**：

   - 前端点击"实时追踪"
   - 观察前端是否收到位置更新
   - 观察小车是否平滑移动
   - 确认位置更新通过 WebSocket 推送

3. **性能测试**：
   - 对比优化前后的系统开销
   - 测试多个订单同时推送时的性能
   - 测试大量无连接订单时的数据库更新性能

## 注意事项

1. **连接状态管理**：确保 Worker 正确跟踪前端连接状态
2. **错误处理**：网络错误时，需要重试机制
3. **序列号**：确保序列号从1开始递增，处理乱序和丢失
4. **数据库更新**：即使没有前端连接，也要持续更新数据库，保证数据完整性

## 未来优化方向

1. **动态调整推送间隔**：根据网络状况动态调整
2. **批量推送**：多个位置更新时，批量推送减少网络开销
3. **断线重连**：前端断线重连后，自动恢复推送
4. **路径预测**：根据历史数据预测路径，提前推送
5. **缓存机制**：前端连接后，可以推送最近的位置更新，避免丢失
