# 统计大屏功能说明

## 新增功能

### 1. 分省/分市收货数量统计

**功能描述**：提供多层级的地理位置统计，支持地图缩放展示。

**数据结构**：

```typescript
deliveryStatisticsByRegion: {
  byProvince: [        // 省份级别统计
    {
      province: "北京市",
      orderCount: 6,
      centerCoordinates: [116.489, 39.9975]  // 省份中心坐标
    }
  ],
  byCity: [            // 城市级别统计
    {
      province: "北京市",
      city: "北京市",
      orderCount: 6,
      centerCoordinates: [116.489, 39.9975]  // 城市中心坐标
    }
  ],
  byCoordinates: [      // 经纬度级别统计（最精细）
    {
      coordinates: [116.488, 39.995],
      orderCount: 4,
      lastDeliveryTime: "2025-12-05T05:00:47.260Z"
    }
  ]
}
```

**使用场景**：

- 省份级别：用于全国地图展示
- 城市级别：用于省份地图缩放展示
- 经纬度级别：用于城市地图详细展示和热力图

**技术实现**：

- 使用PostGIS存储地理坐标
- 通过经纬度范围判断省份和城市（简化实现）
- 实际生产环境建议使用专业的逆地理编码服务（如高德地图、百度地图API）

### 2. 平均配送时间统计

**功能描述**：提供按省份或月份分组的平均配送时间统计。

**数据结构**：

```typescript
averageDeliveryTime: [
  {
    groupKey: "北京市", // 或 "2025-12"（月份格式）
    groupType: "province", // 或 "month"
    averageHours: 0.02, // 平均配送时间（小时）
    averageMinutes: 1.05, // 平均配送时间（分钟）
    orderCount: 2, // 订单数量
  },
];
```

**查询参数**：

- `deliveryTimeGroupBy`: `"province"` 或 `"month"`，默认 `"province"`

**使用示例**：

```bash
# 按省份统计
curl http://localhost:3000/api/v1/dashboard

# 按月份统计
curl "http://localhost:3000/api/v1/dashboard?deliveryTimeGroupBy=month"
```

**计算方式**：

- 配送时间 = `last_update_time - create_time`（对于delivered状态的订单）
- 按分组聚合计算平均值

### 3. 异常订单展示

**功能描述**：显示异常订单的详细信息，包括订单编号和异常原因。

**数据结构**：

```typescript
abnormalOrders: [
  {
    orderId: "809cba43-f75f-4aa8-b8d5-e4763a6bdb8a",
    userId: "user123",
    recipientName: "张三",
    recipientAddress: "北京市朝阳区...",
    status: "pending",
    abnormalReason: "订单待处理时间超过 120 分钟",
    createTime: "2025-12-09T10:00:00.000Z",
    lastUpdateTime: "2025-12-09T10:00:00.000Z",
    abnormalDuration: 3600, // 异常持续时间（秒）
  },
];
```

**异常检测规则**（由Worker服务实现）：

- **Pending订单**：超过2小时未发货
- **Shipping订单**：
  - 配送时间超过4小时
  - 位置更新间隔超过5分钟

**定时推送**：

- Worker服务会定期检测异常订单（默认30秒间隔）
- 异常订单信息实时更新到数据库
- 前端可以通过轮询或WebSocket获取最新异常订单

## API接口

### GET /api/v1/dashboard

**查询参数**：

- `recentUpdatesLimit`: 物流动态数量限制（1-500，默认50）
- `abnormalOrdersLimit`: 异常订单数量限制（1-1000，默认100）
- `deliveryTimeGroupBy`: 平均配送时间分组方式，`"province"` 或 `"month"`，默认 `"province"`
- `startTime`: 开始时间（ISO 8601格式，可选）
- `endTime`: 结束时间（ISO 8601格式，可选）

**响应示例**：

```json
{
  "success": true,
  "data": {
    "totalOrders": 21,
    "completionRate": 28.57,
    "recentLogisticsUpdates": [...],
    "abnormalOrders": [...],
    "vehicleTrajectories": [...],
    "deliveryLocations": [...],
    "deliveryStatisticsByRegion": {
      "byProvince": [...],
      "byCity": [...],
      "byCoordinates": [...]
    },
    "averageDeliveryTime": [...]
  },
  "timestamp": "2025-12-09T14:13:31.163Z"
}
```

## 技术架构

### 省份/城市判断

当前实现使用简化的经纬度范围判断，支持中国主要省份和城市。实际生产环境建议：

1. **使用专业逆地理编码服务**：

   - 高德地图逆地理编码API
   - 百度地图逆地理编码API
   - 腾讯地图逆地理编码API

2. **数据库存储**：

   - 在订单表中添加 `province` 和 `city` 字段
   - 创建订单时通过逆地理编码API获取并存储

3. **缓存优化**：
   - 对相同坐标的逆地理编码结果进行缓存
   - 减少API调用次数

### 性能优化

1. **并行查询**：所有统计数据并行查询，减少总响应时间
2. **数据聚合**：在数据库层面进行聚合计算，减少数据传输量
3. **索引优化**：建议在以下字段创建索引：
   ```sql
   CREATE INDEX idx_orders_merchant_status ON orders(merchant_id, status);
   CREATE INDEX idx_orders_create_time ON orders(create_time);
   CREATE INDEX idx_orders_last_update_time ON orders(last_update_time);
   ```

## 使用建议

### 前端地图展示

1. **全国地图**：使用 `byProvince` 数据，展示各省份订单数量
2. **省份地图**：使用 `byCity` 数据，展示各城市订单数量
3. **城市地图**：使用 `byCoordinates` 数据，展示详细位置和热力图

### 数据刷新

- 建议前端每30秒刷新一次统计数据
- 异常订单可以使用WebSocket实时推送
- 平均配送时间可以每小时更新一次

## 注意事项

1. **省份判断精度**：当前实现是简化版，可能无法准确判断所有坐标的省份。生产环境建议使用专业服务。

2. **配送时间计算**：当前使用 `last_update_time - create_time` 计算，如果订单状态变更历史更详细，可以使用更精确的计算方式。

3. **数据量限制**：建议对返回的数据量进行限制，避免单次查询返回过多数据影响性能。
