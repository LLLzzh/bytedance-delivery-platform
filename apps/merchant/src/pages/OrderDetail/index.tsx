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
  Alert,
  Tag,
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
        height: "85vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* 返回按钮 */}
      <div style={{ marginBottom: 12, alignSelf: "flex-start" }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(-1)}
          size="small"
        >
          返回
        </Button>
      </div>

      <Row gutter={12} style={{ flex: 1, minHeight: 0 }}>
        {/* 左侧：订单信息 */}
        <Col
          span={8}
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
                <Space
                  direction="vertical"
                  size="small"
                  style={{ width: "100%" }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Title level={5} style={{ margin: 0 }}>
                      订单详情 {order.id}
                    </Title>
                    {order.isAbnormal && (
                      <Tag color="error" style={{ margin: 0 }}>
                        异常订单
                      </Tag>
                    )}
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    创建时间: {createTime}
                  </Text>
                  {order.isAbnormal && (
                    <Alert
                      message="异常提醒"
                      description={
                        order.abnormalReason || "订单出现异常情况，请及时处理"
                      }
                      type="error"
                      showIcon
                      style={{ marginTop: 8 }}
                    />
                  )}
                </Space>
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
                        justifyContent: "flex-start",
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
                  {logisticsLogs.map((log, index) => {
                    const isAbnormalLog =
                      order.isAbnormal &&
                      (log.status.includes("异常") ||
                        (order.abnormalReason &&
                          log.status === order.abnormalReason));
                    return (
                      <div
                        key={index}
                        style={{
                          padding: "6px 0",
                          borderBottom:
                            index < logisticsLogs.length - 1
                              ? "1px solid #f0f0f0"
                              : "none",
                          backgroundColor: isAbnormalLog
                            ? "#fff2f0"
                            : "transparent",
                          borderRadius: isAbnormalLog ? "4px" : "0",
                          paddingLeft: isAbnormalLog ? "8px" : "0",
                          paddingRight: isAbnormalLog ? "8px" : "0",
                        }}
                      >
                        <Text
                          type="secondary"
                          style={{ fontSize: 12, marginRight: 8 }}
                        >
                          {log.date} {log.time}
                        </Text>
                        {isAbnormalLog ? (
                          <Space>
                            <Tag
                              color="error"
                              style={{ margin: 0, fontSize: 11 }}
                            >
                              异常
                            </Tag>
                            <Text style={{ fontSize: 12, color: "#ff4d4f" }}>
                              {log.status}
                            </Text>
                          </Space>
                        ) : (
                          <Text style={{ fontSize: 12 }}>{log.status}</Text>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </Space>
          </div>
        </Col>

        {/* 右侧：地图 */}
        <Col
          span={16}
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
                    riderIconUrl="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 80'%3E%3Cdefs%3E%3ClinearGradient id='bodyGrad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%234A90E2;stop-opacity:1' /%3E%3Cstop offset='50%25' style='stop-color:%233579BD;stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:%232E5A8A;stop-opacity:1' /%3E%3C/linearGradient%3E%3ClinearGradient id='topGrad' x1='0%25' y1='0%25' x2='0%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%235BA3E8;stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:%234A90E2;stop-opacity:1' /%3E%3C/linearGradient%3E%3Cfilter id='shadow3d'%3E%3CfeDropShadow dx='3' dy='4' stdDeviation='4' flood-color='%23000' flood-opacity='0.4'/%3E%3C/filter%3E%3C/defs%3E%3Cg filter='url(%23shadow3d)'%3E%3Cpath d='M15 50 L20 50 L22 48 L30 48 L32 50 L70 50 L72 48 L80 48 L82 50 L90 50 L92 52 L92 60 L90 62 L82 62 L80 64 L72 64 L70 62 L32 62 L30 64 L22 64 L20 62 L15 62 Z' fill='url(%23bodyGrad)'/%3E%3Crect x='20' y='35' width='15' height='13' fill='url(%23topGrad)' rx='1'/%3E%3Crect x='50' y='35' width='35' height='13' fill='url(%23topGrad)' rx='1'/%3E%3Crect x='22' y='37' width='11' height='9' fill='%23FFFFFF' opacity='0.6' rx='0.5'/%3E%3Crect x='52' y='37' width='31' height='9' fill='%23FFFFFF' opacity='0.6' rx='0.5'/%3E%3Ccircle cx='28' cy='62' r='7' fill='%231A1A1A'/%3E%3Ccircle cx='28' cy='62' r='4.5' fill='%23FFFFFF'/%3E%3Ccircle cx='28' cy='62' r='2' fill='%23333'/%3E%3Ccircle cx='78' cy='62' r='7' fill='%231A1A1A'/%3E%3Ccircle cx='78' cy='62' r='4.5' fill='%23FFFFFF'/%3E%3Ccircle cx='78' cy='62' r='2' fill='%23333'/%3E%3Cpath d='M15 50 L15 62' stroke='%23244A6E' stroke-width='1.5'/%3E%3Cpath d='M90 50 L90 62' stroke='%23244A6E' stroke-width='1.5'/%3E%3C/g%3E%3C/svg%3E"
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
