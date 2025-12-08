// src/App.tsx
import React from 'react';
import OrderList from './components/OrderList';
import 'antd/dist/reset.css'; // ✅ 引入 antd 样式（v5+ 推荐方式）

export default function App() {
  return (
    <div style={{ padding: '20px 40px' }}>
      <h1 style={{ textAlign: 'center', marginBottom: 32 }}>用户端 - 订单列表（Web 版）</h1>
      <OrderList />
    </div>
  );
}