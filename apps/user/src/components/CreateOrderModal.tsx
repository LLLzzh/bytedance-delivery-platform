import React, { useState } from "react";
import { Modal, Form, Input, InputNumber, Button, message, Space } from "antd";
import {
  orderService,
  CreateOrderRequest,
  Coordinates,
} from "../services/order";
import { AddressPicker } from "./AddressPicker";

// Mock 测试值（与后端保持一致）
const MOCK_USER_ID = "d74823ab-1234-4a2a-b9c2-9e909a7b746c";
const MOCK_MERCHANT_ID = "10001";

interface CreateOrderModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  userId?: string; // 可选，如果不传则使用测试值
}

const CreateOrderModal: React.FC<CreateOrderModalProps> = ({
  open,
  onCancel,
  onSuccess,
  userId,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState<Coordinates | null>(
    null
  );
  const [selectedAddress, setSelectedAddress] = useState<string>("");

  // 处理地图选点
  const handleAddressSelect = (data: {
    coords: [number, number];
    address: string;
  }) => {
    setSelectedCoords(data.coords);
    setSelectedAddress(data.address);
    // 自动填充表单字段
    form.setFieldsValue({
      recipientAddress: data.address,
      recipientCoords: data.coords,
    });
  };

  const handleSubmit = async (values: {
    recipientName: string;
    recipientAddress: string;
    amount: number;
  }) => {
    // 验证是否已选择地址
    if (!selectedCoords) {
      message.warning("请在地图上选择收货地址");
      return;
    }

    if (!selectedAddress || selectedAddress.trim().length < 5) {
      message.warning("请确保地址信息完整（至少5个字符）");
      return;
    }

    try {
      setLoading(true);

      const createData: CreateOrderRequest = {
        userId: userId || MOCK_USER_ID,
        merchantId: MOCK_MERCHANT_ID,
        amount: values.amount,
        recipientName: values.recipientName,
        recipientAddress: selectedAddress,
        recipientCoords: selectedCoords,
      };

      const result = await orderService.createOrder(createData);

      if (result.success) {
        message.success("订单创建成功！");
        form.resetFields();
        setSelectedCoords(null);
        setSelectedAddress("");
        onSuccess();
        onCancel();
      } else {
        message.error("订单创建失败，请稍后重试");
      }
    } catch (error: unknown) {
      console.error("Failed to create order:", error);
      const errorMessage =
        (
          error as {
            response?: { data?: { error?: string } };
            message?: string;
          }
        )?.response?.data?.error ||
        (error as { message?: string })?.message ||
        "订单创建失败，请稍后重试";
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 关闭弹窗时重置状态
  const handleCancel = () => {
    form.resetFields();
    setSelectedCoords(null);
    setSelectedAddress("");
    onCancel();
  };

  return (
    <Modal
      title="新建订单"
      open={open}
      onCancel={handleCancel}
      footer={null}
      width={700}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        autoComplete="off"
      >
        <Form.Item
          name="recipientName"
          label="收货人姓名"
          rules={[
            { required: true, message: "请输入收货人姓名" },
            { min: 2, message: "收货人姓名至少2个字符" },
          ]}
        >
          <Input placeholder="请输入收货人姓名" />
        </Form.Item>

        <Form.Item
          label="收货地址"
          required
          tooltip="请在地图上点击或拖拽标记选择收货地址"
        >
          <AddressPicker
            height={400}
            onSelect={handleAddressSelect}
            defaultCenter={[120.153576, 30.287459]}
          />
          {selectedAddress && (
            <div style={{ marginTop: 8 }}>
              <Input.TextArea
                value={selectedAddress}
                readOnly
                rows={2}
                placeholder="地址将在地图选点后自动填充"
                style={{ background: "#f5f5f5" }}
              />
              {selectedCoords && (
                <div style={{ marginTop: 4, fontSize: 12, color: "#999" }}>
                  坐标: [{selectedCoords[0].toFixed(6)},{" "}
                  {selectedCoords[1].toFixed(6)}]
                </div>
              )}
            </div>
          )}
          {!selectedAddress && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#999" }}>
              请在地图上点击或拖拽标记选择收货地址
            </div>
          )}
        </Form.Item>

        {/* 隐藏字段，用于表单验证 */}
        <Form.Item
          name="recipientAddress"
          hidden
          rules={[
            { required: true, message: "请在地图上选择收货地址" },
            { min: 5, message: "收货地址描述不能太短" },
          ]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          name="amount"
          label="订单金额"
          rules={[
            { required: true, message: "请输入订单金额" },
            { type: "number", min: 0.01, message: "金额必须大于0" },
          ]}
        >
          <InputNumber
            placeholder="请输入订单金额"
            style={{ width: "100%" }}
            prefix="¥"
            precision={2}
            min={0.01}
            step={0.01}
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
          <Space style={{ width: "100%", justifyContent: "flex-end" }}>
            <Button onClick={handleCancel}>取消</Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              创建订单
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreateOrderModal;
