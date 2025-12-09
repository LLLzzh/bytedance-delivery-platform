import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  Row,
  Col,
  Typography,
  Space,
  Avatar,
  Button,
  message,
  Spin,
} from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { orderService, type Order } from "../../services/order";
import {
  generateLogisticsLogs,
  generateOrderGoods,
  formatOrderNo,
  formatCreateTime,
  generateMaskedPhone,
  formatPrice,
} from "./utils";
import MapPlaceholder from "./components/MapPlaceholder";

const { Title, Text } = Typography;

const OrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      message.error("订单ID无效");
      navigate("/DeliveryDispatch");
      return;
    }

    const fetchOrderDetail = async () => {
      setLoading(true);
      try {
        const orderData = await orderService.getOrderById(id);
        setOrder(orderData);
      } catch (error) {
        console.error("获取订单详情失败:", error);
        message.error("获取订单详情失败");
        navigate("/DeliveryDispatch");
      } finally {
        setLoading(false);
      }
    };

    fetchOrderDetail();
  }, [id, navigate]);

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!order) {
    return (
      <div style={{ padding: 24 }}>
        <Text type="danger">订单不存在</Text>
      </div>
    );
  }

  const logisticsLogs = generateLogisticsLogs(order);
  const goods = generateOrderGoods(order);
  const orderNo = formatOrderNo(order.id);
  const createTime = formatCreateTime(order.createTime);
  const recipientPhone = generateMaskedPhone();

  return (
    <div style={{ padding: 24, height: "100%" }}>
      {/* 返回按钮 */}
      <div style={{ marginBottom: 16 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/DeliveryDispatch")}
        >
          返回订单列表
        </Button>
      </div>

      <Row gutter={16} style={{ height: "calc(100% - 60px)" }}>
        {/* 左侧：订单信息 */}
        <Col span={10} style={{ height: "100%", overflow: "auto" }}>
          <Space orientation="vertical" size="large" style={{ width: "100%" }}>
            {/* 订单头部 */}
            <Card>
              <Space
                orientation="vertical"
                size="small"
                style={{ width: "100%" }}
              >
                <Title level={4} style={{ margin: 0 }}>
                  订单详情 {orderNo}
                </Title>
                <Text type="secondary">创建时间: {createTime}</Text>
                <Text
                  type="secondary"
                  style={{ fontSize: 12, fontStyle: "italic" }}
                >
                  这些信息都可以模拟下, 显得更真实
                </Text>
              </Space>
            </Card>

            {/* 收货人信息 */}
            <Card title="收货人信息">
              <Space
                orientation="vertical"
                size="middle"
                style={{ width: "100%" }}
              >
                <div>
                  <Text strong>姓名: </Text>
                  <Text>{order.recipientName}</Text>
                </div>
                <div>
                  <Text strong>电话: </Text>
                  <Text>{recipientPhone}</Text>
                </div>
                <div>
                  <Text strong>地址: </Text>
                  <Text>{order.recipientAddress}</Text>
                </div>
              </Space>
            </Card>

            {/* 商品信息 */}
            <Card title="商品信息">
              <div>
                {goods.map((item, index) => (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "12px 0",
                      borderBottom:
                        index < goods.length - 1 ? "1px solid #f0f0f0" : "none",
                    }}
                  >
                    <Avatar
                      shape="square"
                      size={64}
                      src={item.image}
                      style={{
                        backgroundColor: "#f0f0f0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 16,
                      }}
                    >
                      {!item.image && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          商品图
                        </Text>
                      )}
                    </Avatar>
                    <div style={{ flex: 1 }}>
                      <div style={{ marginBottom: 8 }}>
                        <Text strong>{item.name}</Text>
                      </div>
                      <Space>
                        <Text>x {item.count}</Text>
                        <Text strong style={{ color: "#ff4d4f" }}>
                          ¥ {formatPrice(item.price)}
                        </Text>
                      </Space>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* 物流日志 */}
            <Card title="物流日志">
              <div>
                {logisticsLogs.map((log, index) => (
                  <div
                    key={index}
                    style={{
                      padding: "12px 0",
                      borderBottom:
                        index < logisticsLogs.length - 1
                          ? "1px solid #f0f0f0"
                          : "none",
                    }}
                  >
                    <Space>
                      <Text type="secondary" style={{ minWidth: 60 }}>
                        {log.time}
                      </Text>
                      <Text>- {log.status}</Text>
                    </Space>
                  </div>
                ))}
              </div>
            </Card>
          </Space>
        </Col>

        {/* 右侧：地图 */}
        <Col span={14} style={{ height: "100%" }}>
          <MapPlaceholder order={order} />
        </Col>
      </Row>
    </div>
  );
};

export default OrderDetailPage;
