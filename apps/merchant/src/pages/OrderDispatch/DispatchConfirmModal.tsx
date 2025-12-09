import React, { useMemo, useState } from "react";
import { Modal, Button, Typography, Space, Tag } from "antd";
import { RocketOutlined, EnvironmentOutlined } from "@ant-design/icons";
import RouteSelector from "../../components/RouteSelector";
import { extractPathFromRoute, type Coordinates } from "../../utils/shipping";

const { Text } = Typography;

interface Hub {
  id: string;
  name: string;
  location: [number, number];
  sortingHours?: number;
}

interface DispatchConfirmModalProps {
  orderNo: string;
  fromAddress: string;
  toAddress: string;
  open: boolean;
  onCancel: () => void;
  onConfirm: (routePath: Coordinates[], ruleId: number) => void;
  startLngLat: [number, number];
  endLngLat: [number, number];
  availableHubs?: Hub[];
  defaultRuleId?: number;
}

const DispatchConfirmModal: React.FC<DispatchConfirmModalProps> = ({
  orderNo,
  fromAddress,
  toAddress,
  open,
  onCancel,
  onConfirm,
  startLngLat,
  endLngLat,
  availableHubs = [],
  defaultRuleId = 101,
}) => {
  const [selectedRoutePath, setSelectedRoutePath] = useState<
    Coordinates[] | null
  >(null);
  const [selectedRuleId] = useState<number>(defaultRuleId);

  // 自动匹配中转站逻辑
  const autoSelectedHub = useMemo(() => {
    if (!availableHubs.length) return undefined;
    const matched = availableHubs.find((hub) => {
      const cityName = hub.name.substring(0, 2);
      return toAddress.includes(cityName);
    });
    return matched || availableHubs[0];
  }, [toAddress, availableHubs]);

  // 使用 useMemo 记忆化 waypoints，避免每次渲染创建新数组导致重复请求
  const waypoints = useMemo(() => {
    return autoSelectedHub ? [autoSelectedHub.location] : [];
  }, [autoSelectedHub]);
  const extraTime = useMemo(() => {
    return autoSelectedHub?.sortingHours
      ? autoSelectedHub.sortingHours * 3600
      : 0;
  }, [autoSelectedHub]);

  // 处理路线选择
  const handleRouteSelect = (route: {
    steps?: Array<{ path?: Array<{ lng: number; lat: number }> }>;
  }) => {
    try {
      const path = extractPathFromRoute(route);
      setSelectedRoutePath(path);
    } catch (error) {
      console.error("路线解析失败:", error);
    }
  };

  // 确认发货
  const handleConfirm = () => {
    // 如果没有选择路线，使用默认路径（起点+终点）
    const finalPath: Coordinates[] = selectedRoutePath || [
      startLngLat,
      endLngLat,
    ];

    onConfirm(finalPath, selectedRuleId);
  };

  return (
    <Modal
      title={`订单发货确认: ${orderNo}`}
      open={open}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button
          key="confirm"
          type="primary"
          icon={<RocketOutlined />}
          onClick={handleConfirm}
          style={{ backgroundColor: "#1890ff", borderColor: "#1890ff" }}
        >
          确认发货
        </Button>,
      ]}
      width={900}
      destroyOnClose
    >
      <div style={{ padding: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* 发货地址 */}
          <div>
            <Text strong>发货地址 (商家仓):</Text>
            <Text style={{ marginLeft: 8 }}>{fromAddress}</Text>
          </div>

          {/* 收货地址 */}
          <div>
            <Text strong>收货地址 (用户):</Text>
            <Text style={{ marginLeft: 8 }}>{toAddress}</Text>
          </div>

          {/* 中转站信息 */}
          {autoSelectedHub && (
            <div
              style={{
                background: "#f9f9f9",
                padding: 12,
                borderRadius: 6,
                border: "1px solid #eee",
              }}
            >
              <Space direction="vertical" style={{ width: "100%" }}>
                <Text strong>
                  <EnvironmentOutlined /> 经由中转站点 (系统自动分配):
                </Text>
                <div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <Text strong style={{ color: "#1890ff", fontSize: 16 }}>
                      {autoSelectedHub.name}
                    </Text>
                    <Tag color="orange">
                      分拣耗时: {autoSelectedHub.sortingHours}h
                    </Tag>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary">
                      该订单发往{" "}
                      <Text strong>
                        {toAddress.length > 10
                          ? toAddress.substring(0, 10) + "..."
                          : toAddress}
                      </Text>
                      ，系统已自动规划经由该城市分拨中心进行中转。
                    </Text>
                  </div>
                </div>
              </Space>
            </div>
          )}

          {/* 提示信息 */}
          <div
            style={{
              background: "#fff7d1",
              border: "1px solid #ffe58f",
              borderRadius: 4,
              padding: 12,
              fontSize: 12,
              color: "#d35b00",
            }}
          >
            <Text strong>提示：</Text>
            <Text>
              系统将自动规划：商家仓 → 中转站(停留分拣) → 用户收货地的最优路线
            </Text>
          </div>

          {/* 路线选择器 */}
          <div
            style={{
              marginTop: 8,
              border: "1px solid #f0f0f0",
              borderRadius: 8,
              padding: 16,
            }}
          >
            <RouteSelector
              mode="inline"
              startLngLat={startLngLat}
              endLngLat={endLngLat}
              waypoints={waypoints}
              extraTime={extraTime}
              onConfirm={handleRouteSelect}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default DispatchConfirmModal;
