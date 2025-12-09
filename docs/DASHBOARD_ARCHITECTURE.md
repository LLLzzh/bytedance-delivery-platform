# 统计大屏技术架构文档

## 概述

统计大屏后端接口提供了实时数据统计和监控功能，包括总单数、完成率、物流动态、异常订单监控、车辆轨迹和收货位置热力图数据。

## 技术架构

### 1. 分层架构设计

采用经典的三层架构模式，确保代码的可维护性和可扩展性：

```
Controller Layer (控制器层)
    ↓
Service Layer (业务逻辑层)
    ↓
Repository Layer (数据访问层)
    ↓
Database (PostgreSQL + PostGIS)
```

#### 1.1 Controller Layer (`dashboard.controller.ts`)

- **职责**：处理HTTP请求和响应
- **功能**：
  - 参数验证和类型转换
  - 错误处理和HTTP状态码管理
  - 响应格式标准化

#### 1.2 Service Layer (`dashboard.service.ts`)

- **职责**：业务逻辑编排
- **功能**：
  - 协调多个Repository调用
  - 使用`Promise.all`实现并行查询，提升性能
  - 数据聚合和转换

#### 1.3 Repository Layer (`dashboard.repository.ts`)

- **职责**：数据访问和SQL查询
- **功能**：
  - 封装复杂的PostgreSQL/PostGIS查询
  - 地理空间数据处理（GeoJSON转换）
  - 数据映射和类型转换

### 2. 数据模型设计

#### 2.1 核心数据表

- **orders表**：存储订单信息，包含状态、位置、轨迹等
  - 使用PostGIS的`GEOGRAPHY`类型存储地理坐标
  - `is_abnormal`字段标记异常订单
  - `abnormal_reason`字段记录异常原因

#### 2.2 数据聚合策略

- **总单数**：直接COUNT查询，性能最优
- **完成率**：使用`FILTER`子句聚合，单次查询完成
- **物流动态**：按`last_update_time`排序，限制返回数量
- **异常订单**：基于`is_abnormal`字段筛选
- **车辆轨迹**：查询`shipping`/`arrived`状态的订单，包含完整路径信息
- **收货位置**：按坐标聚合，统计每个位置的订单数量

### 3. 性能优化策略

#### 3.1 并行查询

```typescript
const [
  totalOrders,
  completionRate,
  recentLogisticsUpdates,
  abnormalOrders,
  vehicleTrajectories,
  deliveryLocations,
] = await Promise.all([...]);
```

- 所有数据查询并行执行，减少总响应时间
- 适合大屏场景，需要同时获取多种数据

#### 3.2 索引优化建议

```sql
-- 建议在以下字段上创建索引
CREATE INDEX idx_orders_merchant_status ON orders(merchant_id, status);
CREATE INDEX idx_orders_merchant_abnormal ON orders(merchant_id, is_abnormal) WHERE is_abnormal = true;
CREATE INDEX idx_orders_last_update_time ON orders(last_update_time DESC);
CREATE INDEX idx_orders_status_update_time ON orders(status, last_update_time DESC);
```

#### 3.3 查询限制

- 物流动态：默认限制50条，最大500条
- 异常订单：默认限制100条，最大1000条
- 防止单次查询返回过多数据导致性能问题

### 4. 异常检测集成

#### 4.1 Worker服务异常检测

- Worker服务中的`AnomalyDetector`定期检测订单异常
- 检测规则：
  - **Pending订单**：超过2小时未发货
  - **Shipping订单**：
    - 配送时间超过4小时
    - 位置更新间隔超过5分钟

#### 4.2 异常数据展示

- 统计大屏实时展示异常订单列表
- 包含异常原因和持续时间
- 支持按时间排序，优先显示最新异常

### 5. 地理空间数据处理

#### 5.1 PostGIS集成

- 使用PostGIS的`GEOGRAPHY`类型存储坐标
- 使用`ST_AsGeoJSON`函数转换为GeoJSON格式
- 支持点（Point）和线（LineString）类型

#### 5.2 轨迹计算

- **规划路径**：从`route_path`字段获取（LineString）
- **已走路径**：根据当前位置计算，找到最近路径点，返回起点到该点的所有路径点
- **距离计算**：使用Haversine公式计算两点间距离

### 6. API接口设计

#### 6.1 接口规范

```
GET /api/v1/dashboard
```

#### 6.2 查询参数

- `recentUpdatesLimit`: 物流动态数量限制（1-500，默认50）
- `abnormalOrdersLimit`: 异常订单数量限制（1-1000，默认100）
- `startTime`: 开始时间（ISO 8601格式，可选）
- `endTime`: 结束时间（ISO 8601格式，可选）

#### 6.3 响应格式

```json
{
  "success": true,
  "data": {
    "totalOrders": 1000,
    "completionRate": 85.5,
    "recentLogisticsUpdates": [...],
    "abnormalOrders": [...],
    "vehicleTrajectories": [...],
    "deliveryLocations": [...]
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 7. 最佳实践

#### 7.1 代码组织

- **模块化设计**：每个模块独立目录，职责清晰
- **类型安全**：使用TypeScript严格类型定义
- **错误处理**：统一的错误处理和日志记录

#### 7.2 数据库查询

- **参数化查询**：防止SQL注入
- **连接池管理**：使用pg.Pool管理数据库连接
- **事务处理**：需要时使用事务保证数据一致性

#### 7.3 可扩展性

- **分页支持**：大数据量场景支持分页
- **缓存策略**：可集成Redis缓存热点数据
- **实时更新**：可集成WebSocket推送实时数据

### 8. 监控和运维

#### 8.1 性能监控

- 监控接口响应时间
- 监控数据库查询性能
- 监控异常订单数量趋势

#### 8.2 告警机制

- 异常订单数量超过阈值时告警
- 完成率低于预期时告警
- 接口响应时间过长时告警

### 9. 未来优化方向

#### 9.1 缓存层

- 使用Redis缓存统计数据
- 设置合理的TTL，平衡实时性和性能

#### 9.2 数据聚合表

- 创建物化视图或汇总表
- 定期更新统计数据，减少实时查询压力

#### 9.3 实时推送

- 集成WebSocket，实时推送数据更新
- 减少前端轮询频率

#### 9.4 数据分析

- 集成时间序列数据库（如InfluxDB）
- 支持历史数据分析和趋势预测

## 总结

本架构设计遵循了以下原则：

1. **分层清晰**：Controller-Service-Repository三层架构
2. **性能优先**：并行查询、索引优化、查询限制
3. **类型安全**：完整的TypeScript类型定义
4. **可扩展性**：模块化设计，易于扩展新功能
5. **最佳实践**：符合行业标准的代码组织方式

该架构能够满足统计大屏的实时数据展示需求，同时为未来的功能扩展预留了空间。
