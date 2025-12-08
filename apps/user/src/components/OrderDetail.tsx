import React, { useState, useEffect } from 'react';
import { Card, Typography, Divider, Image, List, Badge, Button } from 'antd';
import { useParams } from 'react-router-dom';
// 假设你有 fetchOrderDetail 函数用于从 API 获取订单详情
// import { fetchOrderDetail } from '../api/orderService';

const { Title, Text } = Typography;

// 🟩 定义商品项类型
interface GoodsItem {
  image: string;
  name: string;
  price: number;
  count: number;
}

// 🟩 定义物流信息项类型
interface LogisticsItem {
  time: string;
  status: string;
}

// 🟩 定义订单详情类型
interface Order {
  orderNo: string;
  merchantName: string;
  merchantAvatar: string;
  goods: GoodsItem[];
  logistics: LogisticsItem[];
  amount: number;
  status: 'pending' | 'shipping' | 'completed';
}

// 🟩 模拟订单详情数据（用于调试）
const mockOrderMap: Record<string, Order> = {
  ORD20250401001: {
    orderNo: 'ORD20250401001',
    merchantName: '美味餐厅',
    merchantAvatar: 'https://via.placeholder.com/48?text=🍔',
    goods: [
      { image: 'https://via.placeholder.com/80?text=🍔', name: '招牌牛肉汉堡', price: 38.5, count: 2 },
      { image: 'https://via.placeholder.com/80?text=🍟', name: '薯条大份', price: 12.0, count: 1 },
    ],
    logistics: [
      { time: '2025-04-01 14:30', status: '已下单' },
      { time: '2025-04-01 16:00', status: '商家已接单' },
      { time: '2025-04-01 17:20', status: '骑手已取餐' },
      { time: '2025-04-01 18:00', status: '配送中' },
    ],
    amount: 89.0,
    status: 'shipping',
  },
  // 其他模拟订单...
};

const OrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('订单ID无效');
      return;
    }

    const mockOrder = mockOrderMap[id];
    if (mockOrder) {
      setOrder(mockOrder);
    } else {
      setError('找不到该订单');
    }
  }, [id]);

  if (error || !order) {
    return (
      <div style={{ padding: 24 }}>
        <Typography.Text type="danger">{error || '订单不存在'}</Typography.Text>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, maxWidth: 800, margin: '0 auto' }}>
      <Card title={`订单详情 - ${order.orderNo}`} style={{ marginBottom: 16 }}>
        {/* 商家信息 */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
          <img src={order.merchantAvatar} alt="商家" style={{ width: 48, height: 48, borderRadius: 24 }} />
          <div style={{ marginLeft: 12 }}>
            <Text strong style={{ fontSize: 16 }}>{order.merchantName}</Text>
          </div>
        </div>

        {/* 商品列表 */}
        <Title level={5}>商品信息</Title>
        <List
          dataSource={order.goods}
          renderItem={(item: GoodsItem) => (
            <List.Item>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <Image src={item.image} width={80} height={80} preview={false} style={{ objectFit: 'cover' }} />
                <div>
                  <Text>{item.name}</Text>
                  <br />
                  <Text type="secondary">
                    ¥{item.price.toFixed(2)} × {item.count}
                  </Text>
                </div>
              </div>
            </List.Item>
          )}
        />

        <Divider />

        {/* 物流信息 */}
        <Title level={5}>物流信息</Title>
        <List
          dataSource={order.logistics}
          renderItem={(log: LogisticsItem) => (
            <List.Item style={{ padding: '8px 0' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <Badge
                  status={order.status === 'shipping' ? 'processing' : 'success'}
                  style={{ marginTop: 4 }}
                />
                <div>
                  <Text strong>{log.status}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 13 }}>{log.time}</Text>
                </div>
              </div>
            </List.Item>
          )}
        />

        <Divider />

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16 }}>
          <Text>实付金额：</Text>
          <Text strong style={{ color: '#ff4d4f' }}>¥{order.amount.toFixed(2)}</Text>
        </div>

        {order.status === 'shipping' && (
          <div style={{ textAlign: 'right', marginTop: 24 }}>
            <Button type="primary" size="large" onClick={() => alert('确认收货成功！')}>
              确认收货
            </Button>
          </div>
        )}

        {order.status === 'completed' && (
          <div style={{ textAlign: 'right', marginTop: 24 }}>
            <Text type="success">✅ 已完成</Text>
          </div>
        )}
      </Card>
    </div>
  );
};

export default OrderDetail;