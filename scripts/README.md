# 测试脚本说明

## 脚本列表

### 1. `test-delivery-flow.sh` - 完整流程自动化测试

测试从创建订单到确认收货的完整流程。

**使用方法**：

```bash
chmod +x scripts/test-delivery-flow.sh
./scripts/test-delivery-flow.sh
```

**功能**：

- ✅ 检查服务状态
- ✅ 创建订单
- ✅ 订单发货
- ✅ 等待位置更新
- ✅ 查询路径历史
- ✅ 检查状态变更
- ✅ 用户确认收货

**前置条件**：

- API 服务运行在 `http://localhost:3000`
- Worker 服务运行在 `http://localhost:3001`
- Mock Logistics 服务正在运行

---

### 2. `test-websocket.js` - WebSocket 实时追踪测试

测试 WebSocket 连接和实时位置推送。

**使用方法**：

```bash
# 首先需要安装 ws 包（如果 Node.js < 18）
pnpm add -w -D ws

# 运行测试（需要先获取一个已发货的订单 ID）
node scripts/test-websocket.js <ORDER_ID>
```

**功能**：

- ✅ 建立 WebSocket 连接
- ✅ 接收连接确认消息
- ✅ 接收位置更新消息
- ✅ 接收状态变更消息
- ✅ 显示统计信息

**示例**：

```bash
# 从 test-delivery-flow.sh 的输出中获取订单 ID
ORDER_ID="xxx-xxx-xxx"
node scripts/test-websocket.js $ORDER_ID
```

---

## 快速开始

### 1. 启动所有服务

```bash
# 终端 1: API 服务
cd apps/api && pnpm dev

# 终端 2: Worker 服务
cd apps/worker && pnpm dev

# 终端 3: Mock Logistics 服务
cd apps/mock-logistics && pnpm dev
```

### 2. 运行完整流程测试

```bash
./scripts/test-delivery-flow.sh
```

### 3. 在另一个终端测试 WebSocket

```bash
# 从上面的测试输出中获取订单 ID
node scripts/test-websocket.js <ORDER_ID>
```

---

## 依赖

- `curl` - 用于 HTTP 请求
- `jq` - 用于 JSON 解析（可选，但推荐）
- `node` - 用于运行 WebSocket 测试脚本
- `ws` - WebSocket 客户端库（Node.js < 18 需要安装）

安装 jq（macOS）：

```bash
brew install jq
```

安装 jq（Linux）：

```bash
sudo apt-get install jq
```

---

## 故障排查

### 脚本无法执行

```bash
# 添加执行权限
chmod +x scripts/test-delivery-flow.sh
```

### jq 命令未找到

如果系统没有安装 jq，可以手动解析 JSON 或安装 jq：

```bash
# macOS
brew install jq

# Linux
sudo apt-get install jq
```

### WebSocket 连接失败

1. 检查 Worker 服务是否运行
2. 检查端口是否正确（默认 3001）
3. 检查订单 ID 是否正确
4. 查看 Worker 服务日志

---

## 更多信息

详细的测试指南请参考：`docs/TESTING_GUIDE.md`
