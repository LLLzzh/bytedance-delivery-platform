#!/bin/bash

# 统计大屏接口测试脚本
# 使用方法: ./scripts/test-dashboard.sh [API_URL]

# 默认API地址
API_URL="${1:-http://localhost:3000}"

echo "=========================================="
echo "统计大屏接口测试"
echo "=========================================="
echo "API地址: ${API_URL}"
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试函数
test_endpoint() {
    local name=$1
    local url=$2
    local description=$3
    
    echo -e "${YELLOW}测试: ${name}${NC}"
    echo "描述: ${description}"
    echo "URL: ${url}"
    echo ""
    
    response=$(curl -s -w "\n%{http_code}" "${url}")
    http_code=$(echo "${response}" | tail -n1)
    body=$(echo "${response}" | sed '$d')
    
    if [ "${http_code}" -eq 200 ]; then
        echo -e "${GREEN}✓ 成功 (HTTP ${http_code})${NC}"
        echo "响应内容:"
        echo "${body}" | jq '.' 2>/dev/null || echo "${body}"
    else
        echo -e "${RED}✗ 失败 (HTTP ${http_code})${NC}"
        echo "响应内容:"
        echo "${body}"
    fi
    echo ""
    echo "----------------------------------------"
    echo ""
}

# 1. 测试基础接口（无参数）
test_endpoint \
    "获取统计大屏数据（默认参数）" \
    "${API_URL}/api/v1/dashboard" \
    "获取所有统计数据，使用默认参数"

# 2. 测试带参数的接口
test_endpoint \
    "获取统计大屏数据（自定义参数）" \
    "${API_URL}/api/v1/dashboard?recentUpdatesLimit=10&abnormalOrdersLimit=20" \
    "限制返回的物流动态和异常订单数量"

# 3. 测试健康检查
test_endpoint \
    "健康检查" \
    "${API_URL}/health" \
    "检查API服务是否正常运行"

echo "=========================================="
echo "测试完成"
echo "=========================================="

