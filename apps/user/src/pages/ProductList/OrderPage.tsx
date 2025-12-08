// src/pages/OrderPage.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import OrderList from '../../components/OrderList';
import OrderDetail from '../../components/OrderDetail';

const OrderPage: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<OrderList />} />
        <Route path="/order/:id" element={<OrderDetail />} />
      </Routes>
    </Router>
  );
};

export default OrderPage;