#!/usr/bin/env node

/**
 * WebSocket 实时追踪测试脚本
 * 使用方法: node scripts/test-websocket.js <ORDER_ID>
 *
 * 注意：Node.js 18+ 内置 WebSocket，无需安装额外包
 */

// 使用 Node.js 内置的 WebSocket（18+）或 ws 包
let WebSocket;
let useNodeWebSocket = false;

try {
  // Node.js 18+ 内置 WebSocket
  // eslint-disable-next-line no-undef
  if (typeof globalThis.WebSocket !== "undefined") {
    // eslint-disable-next-line no-undef
    WebSocket = globalThis.WebSocket;
    useNodeWebSocket = true;
  } else {
    // 使用 ws 包
    WebSocket = require("ws");
    useNodeWebSocket = false;
  }
} catch (e) {
  console.error("❌ 无法加载 WebSocket");
  console.error("   请使用 Node.js 18+ 或安装 ws 包: pnpm add -w -D ws");
  process.exit(1);
}

const ORDER_ID = process.argv[2] || "test-order-id";
const WORKER_URL = process.env.WORKER_URL || "ws://localhost:3006";

if (!ORDER_ID || ORDER_ID === "test-order-id") {
  console.error("❌ 请提供订单 ID");
  console.log("使用方法: node scripts/test-websocket.js <ORDER_ID>");
  process.exit(1);
}

const wsUrl = `${WORKER_URL}/ws/${ORDER_ID}`;
console.log(`🔗 连接到: ${wsUrl}`);
console.log(
  `   使用: ${useNodeWebSocket ? "Node.js 内置 WebSocket" : "ws 包"}`
);
console.log("");

const ws = new WebSocket(wsUrl);

let messageCount = 0;
let positionUpdates = 0;
let statusUpdates = 0;

// Node.js 内置 WebSocket 使用 addEventListener，ws 包使用 .on()
if (useNodeWebSocket) {
  // Node.js 内置 WebSocket API
  ws.addEventListener("open", () => {
    console.log("✅ WebSocket 连接已建立");
    console.log(`📦 订阅订单: ${ORDER_ID}`);
    console.log("");
    console.log("等待消息...");
    console.log("---");
  });

  ws.addEventListener("message", (event) => {
    messageCount++;
    const message = JSON.parse(event.data.toString());
    handleMessage(message);
  });

  ws.addEventListener("error", (error) => {
    console.error("❌ WebSocket 错误:", error.message || error);
  });

  ws.addEventListener("close", (event) => {
    console.log("");
    console.log("---");
    console.log("🔌 WebSocket 连接已关闭");
    console.log(`   关闭代码: ${event.code}`);
    console.log(`   原因: ${event.reason || "正常关闭"}`);
    console.log("");
    console.log("📊 统计:");
    console.log(`   总消息数: ${messageCount}`);
    console.log(`   位置更新: ${positionUpdates}`);
    console.log(`   状态变更: ${statusUpdates}`);
    process.exit(0);
  });
} else {
  // ws 包 API
  ws.on("open", () => {
    console.log("✅ WebSocket 连接已建立");
    console.log(`📦 订阅订单: ${ORDER_ID}`);
    console.log("");
    console.log("等待消息...");
    console.log("---");
  });

  ws.on("message", (data) => {
    messageCount++;
    const message = JSON.parse(data.toString());
    handleMessage(message);
  });

  ws.on("error", (error) => {
    console.error("❌ WebSocket 错误:", error.message);
  });

  ws.on("close", (code, reason) => {
    console.log("");
    console.log("---");
    console.log("🔌 WebSocket 连接已关闭");
    console.log(`   关闭代码: ${code}`);
    console.log(`   原因: ${reason.toString() || "正常关闭"}`);
    console.log("");
    console.log("📊 统计:");
    console.log(`   总消息数: ${messageCount}`);
    console.log(`   位置更新: ${positionUpdates}`);
    console.log(`   状态变更: ${statusUpdates}`);
    process.exit(0);
  });
}

// 处理消息的通用函数
function handleMessage(message) {
  switch (message.type) {
    case "connected":
      console.log(`📨 [${messageCount}] 连接确认`);
      console.log(`   订单 ID: ${message.orderId}`);
      console.log(`   时间: ${message.timestamp}`);
      console.log("");
      break;

    case "position_update":
      positionUpdates++;
      console.log(`📍 [${messageCount}] 位置更新 #${positionUpdates}`);
      console.log(
        `   坐标: [${message.coordinates[0]}, ${message.coordinates[1]}]`
      );
      console.log(`   时间: ${message.timestamp}`);
      console.log("");
      break;

    case "status_update":
      statusUpdates++;
      console.log(`🔄 [${messageCount}] 状态变更 #${statusUpdates}`);
      console.log(`   状态: ${message.status}`);
      console.log(`   消息: ${message.message}`);
      console.log(`   时间: ${message.timestamp}`);
      console.log("");

      if (message.status === "delivered") {
        console.log("✅ 订单已签收，关闭连接");
        ws.close();
      }
      break;

    default:
      console.log(`📨 [${messageCount}] 未知消息类型: ${message.type}`);
      console.log(JSON.stringify(message, null, 2));
      console.log("");
  }
}

// 优雅关闭
process.on("SIGINT", () => {
  console.log("");
  console.log("收到中断信号，关闭连接...");
  ws.close();
});

process.on("SIGTERM", () => {
  console.log("");
  console.log("收到终止信号，关闭连接...");
  ws.close();
});
