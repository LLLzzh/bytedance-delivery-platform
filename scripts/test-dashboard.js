#!/usr/bin/env node

/**
 * 统计大屏接口测试脚本 (Node.js版本)
 * 使用方法: node scripts/test-dashboard.js [API_URL]
 */

const API_URL = process.argv[2] || "http://localhost:3000";

const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  reset: "\x1b[0m",
};

async function testEndpoint(name, url, description) {
  console.log(`${colors.yellow}测试: ${name}${colors.reset}`);
  console.log(`描述: ${description}`);
  console.log(`URL: ${url}`);
  console.log("");

  try {
    const response = await fetch(url);
    const data = await response.json();
    const status = response.status;

    if (status === 200) {
      console.log(`${colors.green}✓ 成功 (HTTP ${status})${colors.reset}`);
      console.log("响应数据结构:");
      console.log(JSON.stringify(data, null, 2));

      // 如果是dashboard数据，显示统计信息
      if (data.data) {
        const dashboard = data.data;
        console.log("\n数据摘要:");
        console.log(`  - 总单数: ${dashboard.totalOrders}`);
        console.log(`  - 完成率: ${dashboard.completionRate}%`);
        console.log(
          `  - 物流动态数量: ${dashboard.recentLogisticsUpdates?.length || 0}`
        );
        console.log(
          `  - 异常订单数量: ${dashboard.abnormalOrders?.length || 0}`
        );
        console.log(
          `  - 车辆轨迹数量: ${dashboard.vehicleTrajectories?.length || 0}`
        );
        console.log(
          `  - 收货位置数量: ${dashboard.deliveryLocations?.length || 0}`
        );
      }
    } else {
      console.log(`${colors.red}✗ 失败 (HTTP ${status})${colors.reset}`);
      console.log("响应内容:", JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.log(`${colors.red}✗ 错误${colors.reset}`);
    console.error("错误信息:", error.message);
  }

  console.log("\n" + "─".repeat(50) + "\n");
}

async function runTests() {
  console.log("=".repeat(50));
  console.log("统计大屏接口测试");
  console.log("=".repeat(50));
  console.log(`API地址: ${API_URL}\n`);

  // 1. 测试基础接口（无参数）
  await testEndpoint(
    "获取统计大屏数据（默认参数）",
    `${API_URL}/api/v1/dashboard`,
    "获取所有统计数据，使用默认参数"
  );

  // 2. 测试带参数的接口
  await testEndpoint(
    "获取统计大屏数据（自定义参数）",
    `${API_URL}/api/v1/dashboard?recentUpdatesLimit=10&abnormalOrdersLimit=20`,
    "限制返回的物流动态和异常订单数量"
  );

  // 3. 测试健康检查
  await testEndpoint(
    "健康检查",
    `${API_URL}/health`,
    "检查API服务是否正常运行"
  );

  console.log("=".repeat(50));
  console.log("测试完成");
  console.log("=".repeat(50));
}

// 运行测试
runTests().catch(console.error);
