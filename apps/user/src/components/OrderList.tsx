// src/components/OrderList.tsx
import React from 'react';
import { Card, List, Tag, Button, Typography, Space, Divider } from 'antd';
import { useNavigate } from 'react-router-dom';

const { Text, Title } = Typography;

const OrderList: React.FC = () => {
  const navigate = useNavigate();

  // 模拟订单数据
  const mockOrders = [
    {
      orderNo: 'ORD20250401001',
      merchantName: '美味餐厅旗舰店',
      status: 'shipping',
      time: '2025-04-01 14:30',
      goods: [
        { name: '招牌牛肉汉堡套餐', price: 38.5, count: 2, image: 'https://via.placeholder.com/60' },
        { name: '薯条大份', price: 12.0, count: 1, image: 'https://via.placeholder.com/60' },
      ],
      amount: 89.0,
    },
    {
      orderNo: 'ORD20250401002',
      merchantName: '鲜果茶饮官方店',
      status: 'completed',
      time: '2025-03-30 18:20',
      goods: [
        { name: '芝士葡萄全糖去冰', price: 22.0, count: 1, image: 'https://via.placeholder.com/60' },
      ],
      amount: 22.0,
    },
  ];

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'pending':
        return <Tag color="blue">待发货</Tag>;
      case 'shipping':
        return <Tag color="orange">配送中</Tag>;
      case 'completed':
        return <Tag color="green">已完成</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <Title level={3} style={{ marginBottom: 24 }}>我的订单</Title>

      <List
        dataSource={mockOrders}
        renderItem={(order) => (
          <List.Item>
            <Card
              size="small"
              title={
                <Space>
                  <Text strong>商家：{order.merchantName}</Text>
                  {getStatusTag(order.status)}
                </Space>
              }
              extra={<Text type="secondary">{order.time}</Text>}
              style={{ width: '100%' }}
            >
              {/* 商品列表 */}
              <List
                dataSource={order.goods}
                renderItem={(item) => (
                  <List.Item style={{ padding: '8px 0' }}>
                    <Space align="start">
                      <img src={item.image} alt={item.name} width={60} height={60} style={{ objectFit: 'cover' }} />
                      <div>
                        <Text>{item.name}</Text>
                        <br />
                        <Text type="secondary">¥{item.price.toFixed(2)} × {item.count}</Text>
                      </div>
                    </Space>
                  </List.Item>
                )}
              />

              <Divider style={{ margin: '12px 0' }} />

              {/* 底部操作栏 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong style={{ fontSize: 16 }}>
                  总计：¥{order.amount.toFixed(2)}
                </Text>
                <Space>
                  <Button onClick={() => navigate(`/order/${order.orderNo}`)}>查看详情</Button>
                  {order.status === 'completed' && <Button type="primary">再次购买</Button>}
                </Space>
              </div>
            </Card>
          </List.Item>
        )}
      />
    </div>
  );
};

export default OrderList;