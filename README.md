# 智能物流配送系统

基于 **Turborepo Monorepo** 架构的智能物流配送系统，实现了从订单创建、配送管理到实时追踪的完整业务流程。系统采用微服务架构，支持多端应用（用户端、商家端、数据看板），提供实时位置追踪、配送围栏配置、异常检测等核心功能。

## 项目结构

```
my-turborepo/
├── apps/
│   ├── api/              # API 服务 (Fastify + PostgreSQL + PostGIS)
│   ├── user/             # 用户端应用 (React + Vite)
│   ├── merchant/         # 商家端应用 (React + Vite)
│   ├── worker/           # Worker 服务 (WebSocket + MQ 消费)
│   └── mock-logistics/   # Mock 物流服务 (位置模拟推送，通过 MQ)
├── packages/
│   ├── ui/               # 共享 UI 组件
│   ├── http-client/      # HTTP 客户端封装
│   ├── eslint-config/    # ESLint 配置
│   └── typescript-config/ # TypeScript 配置
├── docs/                 # 项目文档
├── scripts/              # 测试脚本
└── turbo.json           # Turborepo 配置
```

## 技术栈

### 后端

- **框架**: Fastify（高性能 HTTP 框架）
- **数据库**: PostgreSQL + PostGIS（地理空间数据支持）
- **消息队列**: Redis（基于 List 的轻量级 MQ）
- **实时通信**: WebSocket (@fastify/websocket)
- **语言**: TypeScript

### 前端

- **框架**: React + Vite + TypeScript
- **UI 库**: Ant Design
- **地图**: 高德地图 API
- **状态管理**: React Hooks
- **路由**: React Router

### 基础设施

- **Monorepo**: Turborepo（统一构建、缓存优化）
- **包管理**: pnpm（高效依赖管理）
- **容器化**: Docker + Docker Compose
- **CI/CD**: GitHub Actions
- **代码质量**: ESLint + Prettier + Husky + Commitlint

## 系统架构

```
前端应用层 (User/Merchant/Dashboard)
    ↓ HTTP
API 服务层 (Fastify - 订单/围栏/统计)
    ↓
业务服务层
    ├── Worker Service (WebSocket + MQ 消费 + 异常检测)
    └── Mock Logistics (位置模拟推送，通过 MQ)
    ↓
消息队列层 (Redis MQ - 位置更新队列)
    ↓
数据存储层 (PostgreSQL + PostGIS)
```

## 快速开始

### 前置要求

- Node.js >= 18
- pnpm >= 8
- Docker & Docker Compose（用于数据库和 Redis）

### 安装依赖

```bash
pnpm install
```

### 开发环境

#### 1. 启动基础设施服务

```bash
# 启动 PostgreSQL 和 Redis
docker-compose up -d postgres redis
```

#### 2. 初始化数据库

```bash
# 导入数据库结构和初始数据
psql -h localhost -U postgres -d mydb -f database_dump.sql
# 或者使用 Docker
docker exec -i my-turborepo-postgres psql -U postgres -d mydb < database_dump.sql
```

#### 3. 配置环境变量

在各个服务的目录下创建 `.env` 文件（参考下方环境变量配置）。

#### 4. 启动所有服务

```bash
# 启动所有应用（API、Worker、Mock Logistics、前端应用）
pnpm dev
```

各个服务会在以下端口运行：

- **API 服务**: http://localhost:3000
- **Worker 服务**: http://localhost:3006
- **Mock Logistics**: http://localhost:3005
- **用户端**: http://localhost:5173 (Vite 默认端口)
- **商家端**: http://localhost:3001 (或下一个可用端口)

### 单独启动服务

如果需要单独启动某个服务：

```bash
# API 服务
cd apps/api && pnpm dev

# Worker 服务
cd apps/worker && pnpm dev

# Mock Logistics 服务
cd apps/mock-logistics && pnpm dev

# 用户端
cd apps/user && pnpm dev

# 商家端
cd apps/merchant && pnpm dev

```

## 环境变量配置

### API 服务 (`apps/api/.env`)

```env
PORT=3000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mydb
DB_USER=postgres
DB_PASSWORD=postgres
```

### Worker 服务 (`apps/worker/.env`)

```env
WORKER_PORT=3006
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mydb
DB_USER=postgres
DB_PASSWORD=postgres
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
MQ_QUEUE_NAME=location-updates
POSITION_UPDATE_INTERVAL=1000
ANOMALY_CHECK_INTERVAL=30000
ARRIVAL_THRESHOLD=100
```

### Mock Logistics 服务 (`apps/mock-logistics/.env`)

```env
PORT=3005
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mydb
DB_USER=postgres
DB_PASSWORD=postgres
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
MQ_QUEUE_NAME=location-updates
POSITION_UPDATE_INTERVAL=1000
ORDER_RELOAD_INTERVAL=30000
ARRIVAL_THRESHOLD=100
```

### 前端应用

前端应用使用环境变量（通过 `.env` 或 `.env.local`）：

```env
# 用户端和商家端
VITE_API_BASE_URL=http://localhost:3000
VITE_WORKER_WS_URL=ws://localhost:3006
```

## Docker 部署

### 开发环境

仅启动基础设施（PostgreSQL 和 Redis）：

```bash
docker-compose up -d postgres redis
```

### 生产环境

构建并启动所有服务：

```bash
# 构建并启动所有服务
docker-compose up -d --build
```

服务端口：

- **API 服务**: http://localhost:3000
- **用户端**: http://localhost:3003
- **商家端**: http://localhost:3004
- **数据看板**: http://localhost:3005
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## 核心功能

### 1. 订单管理

- 订单创建（配送范围校验）
- 订单发货（单订单/批量发货，支持多点配送）
- 订单查询（分页、搜索、筛选）
- 订单状态流转（pending → shipping → arrived → delivered）

### 2. 实时位置追踪

- **MQ 架构**：Mock Logistics 通过 Redis MQ 发布位置更新
- **智能推送**：Worker 服务从 MQ 消费，根据前端连接状态决定是否推送
- **WebSocket 连接**：按需连接，用户点击"实时追踪"时才建立连接
- **平滑动画**：前端使用 `requestAnimationFrame` 实现小车移动动画

### 3. 配送围栏管理

- 支持多边形和圆形围栏
- 可视化编辑（基于高德地图）
- 配送范围筛选订单
- PostGIS 空间查询

### 4. 异常检测

- 基于时间差计算的智能检测
- 自动标记异常订单
- 定时检测（Worker 服务每30秒检测一次）

### 5. 数据统计

- 多维度数据统计（省份/城市/月份）
- 配送热力图
- 异常订单监控
- 车辆轨迹展示

## 测试

### 快速测试

运行完整流程自动化测试：

```bash
# 确保所有服务都在运行
# 1. API 服务: cd apps/api && pnpm dev
# 2. Worker 服务: cd apps/worker && pnpm dev
# 3. Mock Logistics 服务: cd apps/mock-logistics && pnpm dev

# 运行测试脚本
./scripts/test-delivery-flow.sh
```

### WebSocket 测试

```bash
# 运行 WebSocket 测试（需要订单 ID）
node scripts/test-websocket.js <ORDER_ID>
```

### Dashboard 测试

```bash
# 测试 Dashboard 数据统计
./scripts/test-dashboard.sh
```

### 详细测试指南

查看 `docs/TESTING_GUIDE.md` 获取完整的测试说明。

## 项目文档

- `docs/PROJECT_PRESENTATION.md` - 项目答辩文档（架构设计、技术亮点）
- `docs/API_DOCUMENTATION.md` - API 接口文档
- `docs/OPTIMIZATION_DELIVERY_TRACKING.md` - 轨迹推送优化方案
- `docs/DASHBOARD_ARCHITECTURE.md` - 数据看板架构
- `docs/TESTING_GUIDE.md` - 测试指南
- `scripts/README.md` - 测试脚本说明

## 开发规范

### Git Hooks

项目配置了 Husky 和 Commitlint，提交代码时会自动：

- 运行 lint-staged 检查和格式化代码
- 验证 commit message 格式

### Commit Message 格式

遵循 [Conventional Commits](https://www.conventionalcommits.org/)：

```
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式调整
refactor: 重构
perf: 性能优化
test: 测试相关
chore: 构建/工具链相关
```

### 代码检查

```bash
# Lint
pnpm lint

# 格式化
pnpm format

# 检查格式化
pnpm format:check
```

## CI/CD

项目配置了 GitHub Actions 工作流：

- **CI**: 在 push 和 PR 时自动运行 lint、format check 和 build
- **Deploy**: 在推送到 main 分支时自动构建 Docker 镜像并部署

## 架构亮点

### 1. 消息队列解耦

- Mock Logistics 和 Worker 通过 Redis MQ 异步通信
- 服务完全解耦，支持独立扩展
- 容错能力强，Worker 异常时消息保留在队列

### 2. 独立 Worker Service

- 将实时物流数据处理从主 API 服务中分离
- WebSocket 长连接维护不影响主 API 性能
- 支持多实例部署，通过负载均衡器分发连接

### 3. 按需 WebSocket 连接

- 用户点击"实时追踪"时才建立连接
- 符合实际生产场景，避免无效连接占用资源

### 4. 智能推送策略

- 有前端连接：更新数据库 + WebSocket 推送
- 无前端连接：仅更新数据库（降低系统开销）

## 许可证

MIT
