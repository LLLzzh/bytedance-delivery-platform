import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout, Typography, Timeline, Button, Empty, Card } from "antd";
import {
  LeftOutlined,
  ClockCircleOutlined,
  HomeOutlined,
  CarOutlined,
} from "@ant-design/icons";
import { DeliveryMap } from "@repo/ui";
import { mockLogistics, LogisticsInfo } from "../mockData";

const { Header, Content } = Layout;
const { Title, Text } = Typography;

const TrackingDetail: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const logisticsInfo: LogisticsInfo | undefined = orderId
    ? mockLogistics[orderId]
    : undefined;

  if (!logisticsInfo) {
    return (
      <Layout style={{ minHeight: "100vh", background: "#fff" }}>
        <Header
          style={{
            background: "#fff",
            padding: "0 16px",
            display: "flex",
            alignItems: "center",
            borderBottom: "1px solid #f0f0f0",
          }}
        >
          <Button
            type="text"
            icon={<LeftOutlined />}
            onClick={() => navigate(-1)}
          />
          <Title
            level={4}
            style={{
              margin: "0 0 0 16px",
              flex: 1,
              textAlign: "center",
              paddingRight: "48px",
            }}
          >
            订单详情
          </Title>
        </Header>
        <Content
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100%",
          }}
        >
          <Empty description="未找到物流信息" />
        </Content>
      </Layout>
    );
  }

  return (
    <Layout
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#fff",
      }}
    >
      {/* Header */}
      <Header
        style={{
          background: "#fff",
          padding: "0 16px",
          display: "flex",
          alignItems: "center",
          borderBottom: "1px solid #f0f0f0",
          height: "50px",
          lineHeight: "50px",
          zIndex: 10,
        }}
      >
        <Button
          type="text"
          icon={<LeftOutlined />}
          onClick={() => navigate(-1)}
        />
        <Title
          level={4}
          style={{
            margin: "0 0 0 16px",
            flex: 1,
            textAlign: "center",
            paddingRight: "48px",
            fontSize: "18px",
          }}
        >
          订单详情
        </Title>
      </Header>

      {/* Map Section (Top 40%) */}
      <div style={{ height: "40%", position: "relative", width: "100%" }}>
        <DeliveryMap
          pathCoordinates={logisticsInfo.path}
          currentPosition={logisticsInfo.currentPos}
          riderIconUrl="https://cdn-icons-png.flaticon.com/512/3063/3063823.png" // Example icon
        />
      </div>

      {/* Timeline Section (Bottom Scrollable) */}
      <Content
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px",
          background: "#fff",
        }}
      >
        <Card bordered={false} style={{ boxShadow: "none" }}>
          <Timeline
            items={logisticsInfo.timeline.map((item, index) => ({
              color: index === 0 ? "green" : "gray",
              dot:
                index === 0 ? (
                  <CarOutlined style={{ fontSize: "16px" }} />
                ) : index === logisticsInfo.timeline.length - 1 ? (
                  <HomeOutlined style={{ fontSize: "16px" }} />
                ) : (
                  <ClockCircleOutlined style={{ fontSize: "16px" }} />
                ),
              children: (
                <div style={{ paddingBottom: "20px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "4px",
                    }}
                  >
                    <Text
                      strong={index === 0}
                      style={{
                        fontSize: index === 0 ? "16px" : "14px",
                        color: index === 0 ? "#000" : "#666",
                      }}
                    >
                      {item.status}
                    </Text>
                    <div style={{ textAlign: "right" }}>
                      <Text
                        type="secondary"
                        style={{ fontSize: "12px", display: "block" }}
                      >
                        {item.date}
                      </Text>
                      <Text type="secondary" style={{ fontSize: "12px" }}>
                        {item.time}
                      </Text>
                    </div>
                  </div>
                  <Text type="secondary" style={{ fontSize: "13px" }}>
                    {item.detail}
                  </Text>
                </div>
              ),
            }))}
          />
        </Card>
      </Content>
    </Layout>
  );
};

export default TrackingDetail;
