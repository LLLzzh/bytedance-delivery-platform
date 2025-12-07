#!/bin/bash

# 测试从发货开始的后端全流程
# 使用方法: ./scripts/test-delivery-flow.sh

set -e

# 颜色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 配置
API_URL="http://localhost:3000"
WORKER_URL="http://localhost:3006"
MOCK_MERCHANT_ID="10001"
MOCK_USER_ID="d74823ab-1234-4a2a-b9c2-9e909a7b746c"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}测试从发货开始的后端全流程${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 检查服务是否运行
echo -e "${YELLOW}1. 检查服务状态...${NC}"
if ! curl -s "${API_URL}/health" > /dev/null; then
    echo -e "${RED}❌ API 服务未运行，请先启动: cd apps/api && pnpm dev${NC}"
    exit 1
fi
echo -e "${GREEN}✓ API 服务运行中${NC}"

if ! curl -s "${WORKER_URL}/health" > /dev/null; then
    echo -e "${RED}❌ Worker 服务未运行，请先启动: cd apps/worker && pnpm dev${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Worker 服务运行中${NC}"
echo ""

# 步骤 1: 创建订单
echo -e "${YELLOW}2. 创建订单...${NC}"
# 使用围栏范围内的坐标（根据现有围栏数据调整）
# 围栏范围大约在 [116.48, 39.99] 到 [116.5, 40.01] 之间
RECIPIENT_COORDS="[116.49, 40.0]"

ORDER_RESPONSE=$(curl -s -X POST "${API_URL}/api/v1/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "'"${MOCK_USER_ID}"'",
    "amount": 299.00,
    "recipientName": "测试用户",
    "recipientAddress": "北京市朝阳区测试地址",
    "recipientCoords": '"${RECIPIENT_COORDS}"',
    "merchantId": "'"${MOCK_MERCHANT_ID}"'"
  }')

ORDER_ID=$(echo $ORDER_RESPONSE | jq -r '.order.id // empty')
if [ -z "$ORDER_ID" ]; then
    echo -e "${RED}❌ 创建订单失败${NC}"
    echo "$ORDER_RESPONSE" | jq .
    exit 1
fi
echo -e "${GREEN}✓ 订单创建成功: ${ORDER_ID}${NC}"
echo "订单详情:"
echo "$ORDER_RESPONSE" | jq '.order | {id, status, recipientName, recipientAddress}'
echo ""

# 步骤 2: 发货（需要先准备路径数据）
echo -e "${YELLOW}3. 准备发货路径...${NC}"
# 生成一个较长的测试路径（从发货地址到收货地址）
# 使用与收货地址匹配的坐标范围，包含更多中间点以模拟真实配送路径
ROUTE_PATH='[
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
]'
echo -e "${GREEN}✓ 路径准备完成（共 22 个路径点）${NC}"
echo ""

# 步骤 3: 发货
echo -e "${YELLOW}4. 订单发货...${NC}"
SHIP_RESPONSE=$(curl -s -X POST "${API_URL}/api/v1/orders/${ORDER_ID}/ship" \
  -H "Content-Type: application/json" \
  -d '{
    "ruleId": 101,
    "routePath": '"${ROUTE_PATH}"'
  }')

if [ "$(echo $SHIP_RESPONSE | jq -r '.success')" != "true" ]; then
    echo -e "${RED}❌ 发货失败${NC}"
    echo "$SHIP_RESPONSE" | jq .
    exit 1
fi
echo -e "${GREEN}✓ 订单发货成功，状态已更新为 shipping${NC}"
echo "发货响应:"
echo "$SHIP_RESPONSE" | jq '.data.order | {id, status, ruleId}'
echo ""

# 步骤 4: 等待 Mock Logistics 开始推送位置
echo -e "${YELLOW}5. 等待 Mock Logistics 服务检测到订单并开始推送位置...${NC}"
echo "（Mock Logistics 服务会每 30 秒检查一次新订单）"
echo "等待 35 秒..."
sleep 35
echo -e "${GREEN}✓ 等待完成${NC}"
echo ""

# 步骤 5: 查询订单详情，检查位置是否更新
echo -e "${YELLOW}6. 查询订单详情，检查位置更新...${NC}"
ORDER_DETAIL=$(curl -s "${API_URL}/api/v1/orders/${ORDER_ID}")
CURRENT_POS=$(echo $ORDER_DETAIL | jq -r '.order.currentPosition // empty')
if [ -n "$CURRENT_POS" ] && [ "$CURRENT_POS" != "null" ]; then
    echo -e "${GREEN}✓ 位置已更新: ${CURRENT_POS}${NC}"
else
    echo -e "${YELLOW}⚠ 位置尚未更新（可能 Mock Logistics 还未开始推送）${NC}"
fi
echo "订单状态:"
echo "$ORDER_DETAIL" | jq '.order | {id, status, currentPosition, lastUpdateTime}'
echo ""

# 步骤 6: 检查已走过的路径
echo -e "${YELLOW}7. 检查已走过的路径...${NC}"
PATH_RESPONSE=$(curl -s "${API_URL}/api/v1/orders/${ORDER_ID}/path")
TRAVELED_PATH=$(echo $PATH_RESPONSE | jq -r '.data.traveledPath // []')
TRAVELED_COUNT=$(echo $TRAVELED_PATH | jq 'length')
echo -e "${GREEN}✓ 已走过 ${TRAVELED_COUNT} 个路径点${NC}"
if [ "$TRAVELED_COUNT" -gt 0 ]; then
    echo "已走过的路径点:"
    echo "$TRAVELED_PATH" | jq '.[0:3]' # 只显示前3个点
fi
echo ""

# 步骤 7: 等待订单到达（模拟）
echo -e "${YELLOW}8. 等待订单配送过程...${NC}"
echo "（根据配送时效，订单会逐步更新位置）"
echo "等待 10 秒后再次检查..."
sleep 10

ORDER_DETAIL=$(curl -s "${API_URL}/api/v1/orders/${ORDER_ID}")
STATUS=$(echo $ORDER_DETAIL | jq -r '.order.status')
echo "当前订单状态: ${STATUS}"

if [ "$STATUS" = "arrived" ]; then
    echo -e "${GREEN}✓ 订单已到达收货地址！${NC}"
    
    # 步骤 8: 用户确认收货
    echo ""
    echo -e "${YELLOW}9. 用户确认收货...${NC}"
    DELIVER_RESPONSE=$(curl -s -X POST "${API_URL}/api/v1/orders/${ORDER_ID}/deliver")
    
    if [ "$(echo $DELIVER_RESPONSE | jq -r '.success')" = "true" ]; then
        echo -e "${GREEN}✓ 收货确认成功！${NC}"
        echo "最终订单状态:"
        echo "$DELIVER_RESPONSE" | jq '.data.order | {id, status}'
    else
        echo -e "${RED}❌ 收货确认失败${NC}"
        echo "$DELIVER_RESPONSE" | jq .
    fi
else
    echo -e "${YELLOW}⚠ 订单尚未到达，当前状态: ${STATUS}${NC}"
    echo "提示: 订单需要更长时间才能到达，或者可以手动调用确认收货接口"
fi
echo ""

# 总结
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}测试完成${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "订单 ID: ${ORDER_ID}"
echo "可以继续使用以下命令查看订单状态:"
echo "  curl ${API_URL}/api/v1/orders/${ORDER_ID}"
echo ""
echo "查看路径历史:"
echo "  curl ${API_URL}/api/v1/orders/${ORDER_ID}/path"
echo ""

