# 用户端架构说明

## 概述

用户端应用实现了与后端API和WebSocket服务的完整交互，支持订单列表查看和实时物流追踪功能。

## 架构设计

### 1. 服务层 (Services)

#### API 服务 (`services/api-client.ts`)

- 使用 `@repo/http-client` 包创建统一的HTTP客户端
- 配置了认证、错误处理等通用功能
- 默认连接 `http://localhost:3000`（可通过环境变量 `VITE_API_BASE_URL` 配置）

#### 订单服务 (`services/order.ts`)

- 提供订单相关的所有API调用方法：
  - `getOrders()` - 获取订单列表（支持分页、筛选、搜索）
  - `getOrderDetail()` - 获取订单详情
  - `getOrderPath()` - 获取订单路径历史
  - `confirmDelivery()` - 确认收货
- 定义了与后端一致的订单类型和状态枚举

#### WebSocket 服务 (`services/websocket.ts`)

- `WebSocketClient` 类：管理WebSocket连接
- 功能特性：
  - 自动重连机制（最多5次）
  - 心跳保活（30秒ping）
  - 消息类型处理（位置更新、状态更新等）
  - 错误处理和连接状态管理
- 默认连接 `ws://localhost:3006`（可通过环境变量 `VITE_WORKER_WS_URL` 配置）

### 2. Hooks 层

#### `useOrderTracking` Hook (`hooks/useOrderTracking.ts`)

手动管理WebSocket连接的React Hook：

**连接策略：**

- ✅ **仅在以下状态时可以建立连接：**

  - `OrderStatus.Shipping` (运输中)
  - `OrderStatus.Arrived` (已到达)

- ❌ **以下状态不支持连接：**
  - `OrderStatus.Pending` (待处理)
  - `OrderStatus.PickedUp` (已取件)
  - `OrderStatus.Delivered` (已签收)
  - `OrderStatus.Cancelled` (已取消)

**手动管理：**

- **不自动建立连接**，需要用户点击"查看实时路径"按钮
- 组件卸载时自动清理连接
- 订单状态变为已完成/已取消时自动断开
- 提供 `connect()` 和 `disconnect()` 方法供组件调用

### 3. 页面层

#### 订单列表页面 (`pages/OrderList.tsx`)

- **数据获取方式：** HTTP GET 请求
- **刷新机制：** 支持手动刷新
- **功能：**
  - 显示订单列表（订单号、状态、收货信息、金额）
  - 搜索功能（订单号、收货人、地址）
  - 点击跳转到订单详情页

#### 订单详情/追踪页面 (`pages/TrackingDetail.tsx`)

- **初始加载：** HTTP GET 请求获取订单详情和路径历史
- **实时更新：** 用户点击"查看实时路径"按钮后建立 WebSocket 连接
- **功能：**
  - 地图显示订单路径和当前位置
  - 时间线显示物流进度
  - **"查看实时路径"按钮：** 手动触发 WebSocket 连接（仅在运输中/已到达状态显示）
  - 实时位置更新（通过WebSocket，后端定时推送）
  - 实时状态更新（通过WebSocket）
  - 确认收货功能（已到达状态）
  - 手动刷新功能
  - 连接状态指示（地图右上角显示"实时追踪中"）

## 业务场景与交互方式

### 场景1: 查看订单列表

```
用户操作 → HTTP GET /api/v1/orders → 显示订单列表
```

- 使用HTTP请求，支持分页和筛选
- 无需WebSocket连接

### 场景2: 查看已完成订单详情

```
用户操作 → HTTP GET /api/v1/orders/:id → 显示订单详情（静态数据）
```

- 使用HTTP请求获取订单详情和历史路径
- 不建立WebSocket连接（订单已完成，无需实时更新）

### 场景3: 查看运输中订单详情（核心场景）

```
1. 初始加载：
   用户操作 → HTTP GET /api/v1/orders/:id → 显示订单详情
            → HTTP GET /api/v1/orders/:id/path → 显示路径历史

2. 实时追踪（用户主动触发）：
   用户点击"查看实时路径"按钮 → 建立 WebSocket 连接
   → 后端定时推送位置更新（按时间间隔）→ 实时更新地图，车辆定时移动
   → 接收状态更新 → 实时更新状态和时间线
   → 用户点击"断开实时追踪" → 断开 WebSocket 连接
```

- 初始数据通过HTTP请求获取
- **默认不建立WebSocket连接**，节省资源
- 用户点击按钮后才建立连接
- 后端按时间间隔推送位置，实现车辆定时移动效果
- 页面离开时自动断开连接

### 场景4: 订单状态变更

```
订单状态变为 delivered/cancelled → 自动断开 WebSocket 连接
```

- 订单完成后不再需要实时更新，自动清理连接

## 环境变量配置

在项目根目录创建 `.env` 文件（或使用环境变量）：

```env
# API 服务地址
VITE_API_BASE_URL=http://localhost:3000

# WebSocket 服务地址
VITE_WORKER_WS_URL=ws://localhost:3006
```

## 代码层次结构

```
apps/user/src/
├── services/           # 服务层
│   ├── api-client.ts   # HTTP客户端配置
│   ├── order.ts        # 订单API服务
│   ├── websocket.ts    # WebSocket客户端
│   └── index.ts        # 统一导出
├── hooks/              # React Hooks
│   └── useOrderTracking.ts  # WebSocket连接管理Hook
└── pages/              # 页面组件
    ├── OrderList.tsx   # 订单列表页
    └── TrackingDetail.tsx  # 订单详情/追踪页
```

## 最佳实践

1. **连接管理：**

   - **默认不建立WebSocket连接**，用户主动点击按钮才连接
   - 仅在运输中/已到达状态时显示"查看实时路径"按钮
   - 及时清理不需要的连接，避免资源浪费
   - 订单完成后自动断开连接

2. **错误处理：**

   - HTTP请求失败时显示友好的错误提示
   - WebSocket连接失败不影响主要功能（仍可查看静态路径）
   - 连接错误通过回调传递给组件层处理

3. **用户体验：**

   - 加载状态提示
   - 实时连接状态指示（地图右上角）
   - 按钮状态反映连接状态（"查看实时路径" / "断开实时追踪"）
   - 支持手动刷新

4. **性能优化：**
   - 使用React Hooks管理状态和副作用
   - 避免不必要的重渲染
   - WebSocket连接按需建立，不浪费资源
   - 后端定时推送位置，实现平滑的车辆移动效果

## 与后端交互流程

```
┌─────────────┐
│  用户端应用  │
└──────┬──────┘
       │
       ├─── HTTP ────→ API服务 (localhost:3000)
       │              - 获取订单列表
       │              - 获取订单详情
       │              - 获取路径历史
       │              - 确认收货
       │
       └─── WebSocket ───→ Worker服务 (localhost:3006)
                          - 实时位置更新
                          - 实时状态更新
                          (仅在 shipping/arrived 状态)
```

## 注意事项

1. **WebSocket连接时机：** 只有在订单状态为 `shipping` 或 `arrived` 时才建立连接，避免不必要的资源消耗。

2. **连接清理：** 页面离开或订单状态变为已完成/已取消时，会自动断开WebSocket连接。

3. **降级策略：** 如果WebSocket连接失败，不影响订单详情的查看（通过HTTP请求获取），只是无法实时更新。

4. **类型安全：** 前后端使用一致的订单状态枚举和类型定义，确保类型安全。
