// 地图占位组件（等待同事实现）
import React from "react";
import { Card, Button, Space, Typography } from "antd";
import { ReloadOutlined, GlobalOutlined } from "@ant-design/icons";
import { Order, OrderStatus } from "../../../services/order";
import { getStatusText } from "../utils";

const { Text } = Typography;

interface MapPlaceholderProps {
  order: Order;
}

const MapPlaceholder: React.FC<MapPlaceholderProps> = ({ order }) => {
  // 根据订单状态确定显示文本
  const getStatusButtonText = (status: OrderStatus): string => {
    if (["shipping", "pickedUp", "arrived"].includes(status)) {
      return "运输中";
    }
    if (status === "delivered") {
      return "已送达";
    }
    if (status === "pending") {
      return "待发货";
    }
    return getStatusText(status);
  };

  return (
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
          padding: 16,
        },
      }}
    >
      {/* 状态按钮 */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: 16,
        }}
      >
        <Button type="primary" size="large">
          {getStatusButtonText(order.status)}
        </Button>
      </div>

      {/* 地图控制按钮 */}
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button icon={<ReloadOutlined />} size="small">
            刷新位置
          </Button>
          <Button icon={<GlobalOutlined />} size="small">
            切换卫星图
          </Button>
        </Space>
      </div>

      {/* 地图占位区域 */}
      <div
        style={{
          flex: 1,
          border: "1px dashed #d9d9d9",
          borderRadius: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#fafafa",
          minHeight: 400,
        }}
      >
        <Text type="secondary" style={{ fontSize: 16 }}>
          [此处加载高德地图组件]
        </Text>
      </div>

      {/* 地图功能说明 */}
      <div style={{ marginTop: 16 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          显示完整路径 + 实时车辆Marker + 预计到达时间
        </Text>
      </div>
    </Card>
  );
};

export default MapPlaceholder;
