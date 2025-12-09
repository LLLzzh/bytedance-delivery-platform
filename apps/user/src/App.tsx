import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import OrderList from "./pages/OrderList";
import TrackingDetail from "./pages/TrackingDetail";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";

const App: React.FC = () => {
  return (
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<OrderList />} />
          <Route path="/tracking/:orderId" element={<TrackingDetail />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
};

export default App;
