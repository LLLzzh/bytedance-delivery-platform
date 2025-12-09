import React, { useState } from "react";
import { Input, List, Card, Tag, Typography, Button, Layout } from "antd";
import { SearchOutlined, EnvironmentOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { mockOrders, Order } from "../mockData";

const { Title, Text } = Typography;
const { Header, Content } = Layout;

const OrderList: React.FC = () => {
  const [searchText, setSearchText] = useState("");
  const navigate = useNavigate();

  const filteredOrders = mockOrders.filter((order) =>
    order.orderNo.toLowerCase().includes(searchText.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "运输中":
      case "派送中":
        return "processing";
      case "已签收":
        return "success";
      default:
        return "default";
    }
  };

  return (
    <Layout style={{ minHeight: "100vh", background: "#f5f5f5" }}>
      <Header
        style={{
          background: "#fff",
          padding: "0 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "sticky",
          top: 0,
          zIndex: 1,
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          我的订单
        </Title>
      </Header>
      <Content style={{ padding: "16px" }}>
        <Input
          placeholder="输入订单号搜索"
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{
            marginBottom: "16px",
            borderRadius: "8px",
            padding: "8px 11px",
          }}
        />

        <List
          grid={{ gutter: 16, column: 1 }}
          dataSource={filteredOrders}
          renderItem={(item: Order) => (
            <List.Item>
              <Card
                hoverable
                style={{ borderRadius: "12px", overflow: "hidden" }}
                bodyStyle={{ padding: "12px" }}
                onClick={() => navigate(`/tracking/${item.id}`)}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "12px",
                    borderBottom: "1px solid #f0f0f0",
                    paddingBottom: "8px",
                  }}
                >
                  <Text strong>{item.orderNo}</Text>
                  <Tag color={getStatusColor(item.status)}>{item.status}</Tag>
                </div>

                <div style={{ display: "flex", gap: "12px" }}>
                  <div
                    style={{
                      width: "80px",
                      height: "80px",
                      flexShrink: 0,
                      background: "#f0f0f0",
                      borderRadius: "8px",
                      overflow: "hidden",
                    }}
                  >
                    <img
                      src={item.productImage}
                      alt={item.productName}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text strong style={{ fontSize: "16px" }}>
                      {item.productName}
                    </Text>
                    <div style={{ fontSize: "12px", color: "#888" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <EnvironmentOutlined />{" "}
                        <Text
                          ellipsis
                          style={{ maxWidth: "180px", color: "#888" }}
                        >
                          发: {item.fromAddress}
                        </Text>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          marginTop: "4px",
                        }}
                      >
                        <EnvironmentOutlined />{" "}
                        <Text
                          ellipsis
                          style={{ maxWidth: "180px", color: "#888" }}
                        >
                          收: {item.toAddress}
                        </Text>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "12px",
                    display: "flex",
                    justifyContent: "flex-end",
                  }}
                >
                  <Button
                    type="primary"
                    size="small"
                    shape="round"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/tracking/${item.id}`);
                    }}
                  >
                    查看物流
                  </Button>
                </div>
              </Card>
            </List.Item>
          )}
        />
      </Content>
    </Layout>
  );
};

export default OrderList;
