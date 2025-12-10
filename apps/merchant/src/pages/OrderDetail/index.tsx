import React, { useState, useEffect, useCallback } from "react";
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
  Empty,
} from "antd";
import { ArrowLeftOutlined, ReloadOutlined } from "@ant-design/icons";
import { DeliveryMap } from "@repo/ui";
import {
  orderService,
  type Order,
  type Coordinates,
} from "../../services/order";
import {
  generateLogisticsLogs,
  generateOrderGoods,
  formatCreateTime,
  formatPrice,
} from "./utils";

const { Title, Text } = Typography;

const OrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [pathData, setPathData] = useState<{
    routePath: Coordinates[];
    traveledPath: Coordinates[];
    currentPosition?: Coordinates;
  } | null>(null);
  const [pathLoading, setPathLoading] = useState(false);

  // 获取订单路径数据
  const fetchOrderPath = useCallback(async (orderId: string) => {
    setPathLoading(true);
    try {
      const path = await orderService.getOrderPath(orderId);
      setPathData({
        routePath: path.routePath || [],
        traveledPath: path.traveledPath || [],
        currentPosition: path.currentPosition,
      });
    } catch (error) {
      console.error("获取订单路径失败:", error);
      message.error("获取订单路径失败");
    } finally {
      setPathLoading(false);
    }
  }, []);

  // 获取订单详情和路径数据
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

        // 如果订单有路径信息，获取路径数据
        if (
          orderData.status === "shipping" ||
          orderData.status === "arrived" ||
          orderData.status === "delivered"
        ) {
          fetchOrderPath(id);
        }
      } catch (error) {
        console.error("获取订单详情失败:", error);
        message.error("获取订单详情失败");
        navigate("/DeliveryDispatch");
      } finally {
        setLoading(false);
      }
    };

    fetchOrderDetail();
  }, [id, navigate, fetchOrderPath]);

  // 刷新路径数据
  const handleRefreshPath = useCallback(() => {
    if (id) {
      fetchOrderPath(id);
    }
  }, [id, fetchOrderPath]);

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
  const createTime = formatCreateTime(order.createTime);

  return (
    <div
      style={{
        padding: 16,
        height: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* 返回按钮 */}
      <div style={{ marginBottom: 12 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/DeliveryDispatch")}
          size="small"
        >
          返回订单列表
        </Button>
      </div>

      <Row gutter={12} style={{ flex: 1, minHeight: 0 }}>
        {/* 左侧：订单信息 */}
        <Col
          span={10}
          style={{ height: "100%", display: "flex", flexDirection: "column" }}
        >
          <div style={{ height: "100%", overflow: "auto", paddingRight: 8 }}>
            <Space
              orientation="vertical"
              size="small"
              style={{ width: "100%" }}
            >
              {/* 订单头部 */}
              <Card size="small">
                <Title level={5} style={{ margin: 0, marginBottom: 8 }}>
                  订单详情 {order.id}
                </Title>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  创建时间: {createTime}
                </Text>
              </Card>

              {/* 收货人信息 */}
              <Card title="收货人信息" size="small">
                <div style={{ textAlign: "left" }}>
                  <div style={{ marginBottom: 8 }}>
                    <Text strong>姓名: </Text>
                    <Text>{order.recipientName}</Text>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <Text strong>地址: </Text>
                    <Text>{order.recipientAddress}</Text>
                  </div>
                </div>
              </Card>

              {/* 商品信息 */}
              <Card title="商品信息" size="small">
                <div>
                  {goods.map((item, index) => (
                    <div
                      key={index}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "8px 0",
                        borderBottom:
                          index < goods.length - 1
                            ? "1px solid #f0f0f0"
                            : "none",
                      }}
                    >
                      <Avatar
                        shape="square"
                        size={48}
                        src={item.image}
                        style={{
                          backgroundColor: "#f0f0f0",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          marginRight: 12,
                        }}
                      >
                        {!item.image && (
                          <Text type="secondary" style={{ fontSize: 10 }}>
                            商品图
                          </Text>
                        )}
                      </Avatar>
                      <div style={{ flex: 1 }}>
                        <div style={{ marginBottom: 4 }}>
                          <Text strong style={{ fontSize: 13 }}>
                            {item.name}
                          </Text>
                        </div>
                        <Space size="small">
                          <Text style={{ fontSize: 12 }}>x {item.count}</Text>
                          <Text
                            strong
                            style={{ color: "#ff4d4f", fontSize: 13 }}
                          >
                            ¥ {formatPrice(item.price)}
                          </Text>
                        </Space>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* 物流日志 */}
              <Card title="物流日志" size="small">
                <div style={{ textAlign: "left" }}>
                  {logisticsLogs.map((log, index) => (
                    <div
                      key={index}
                      style={{
                        padding: "6px 0",
                        borderBottom:
                          index < logisticsLogs.length - 1
                            ? "1px solid #f0f0f0"
                            : "none",
                      }}
                    >
                      <Text
                        type="secondary"
                        style={{ fontSize: 12, marginRight: 8 }}
                      >
                        {log.time}
                      </Text>
                      <Text style={{ fontSize: 12 }}>{log.status}</Text>
                    </div>
                  ))}
                </div>
              </Card>
            </Space>
          </div>
        </Col>

        {/* 右侧：地图 */}
        <Col
          span={14}
          style={{ height: "100%", display: "flex", flexDirection: "column" }}
        >
          <Card
            style={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
            }}
            styles={{
              body: {
                flex: 1,
                display: "flex",
                flexDirection: "column",
                padding: 12,
                position: "relative",
                minHeight: 0,
              },
            }}
          >
            {/* 地图控制按钮 */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-start",
                alignItems: "center",
                marginBottom: 8,
                zIndex: 10,
              }}
            >
              <Button
                icon={<ReloadOutlined />}
                size="small"
                onClick={handleRefreshPath}
                loading={pathLoading}
              >
                刷新路径
              </Button>
            </div>

            {/* 地图容器 */}
            <div
              style={{
                flex: 1,
                position: "relative",
                background: "#f5f5f5",
                minHeight: 0,
              }}
            >
              {pathLoading ? (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "100%",
                  }}
                >
                  <Spin size="large" />
                </div>
              ) : pathData &&
                pathData.routePath.length > 0 &&
                pathData.routePath.every(
                  (coord) => Array.isArray(coord) && coord.length === 2
                ) ? (
                <div
                  style={{
                    height: "100%",
                    width: "100%",
                    position: "relative",
                  }}
                >
                  <DeliveryMap
                    pathCoordinates={pathData.routePath}
                    currentPosition={
                      pathData.currentPosition || pathData.routePath[0]
                    }
                    traveledPath={pathData.traveledPath}
                    riderIconUrl="https://cdn-icons-png.flaticon.com/512/3063/3063823.png"
                    enableAnimatedPath={true}
                  />
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "100%",
                    width: "100%",
                  }}
                >
                  <Empty description="暂无路径信息" />
                </div>
              )}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default OrderDetailPage;
