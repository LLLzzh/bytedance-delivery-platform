import React, { useState, useMemo } from "react";
import {
  Card,
  Row,
  Col,
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  Table,
  Tag,
  Tooltip,
  Space,
} from "antd";
import { SearchOutlined, TruckOutlined } from "@ant-design/icons";

// 导入发货确认弹窗
import DispatchConfirmModal from "./DispatchConfirmModal";

// 类型定义
type StatusType = "pending" | "shipping" | "completed";

interface OrderItem {
  key: string;
  orderNo: string;
  receiver: string;
  address: string;
  amount: number;
  status: StatusType;
  createTime: string; // 格式：'YYYY-MM-DD HH:mm'
  startLngLat?: [number, number];
  endLngLat?: [number, number];
}

const statusMap: Record<StatusType, { label: string; color: string }> = {
  pending: { label: "待发货", color: "orange" },
  shipping: { label: "运输中", color: "blue" },
  completed: { label: "已完成", color: "green" },
};

// 模拟中转站数据
const TRANSIT_HUBS = [
  {
    id: "h1",
    name: "杭州黄龙中转站",
    location: [120.153576, 30.287459] as [number, number],
    sortingHours: 2,
  },
  {
    id: "h2",
    name: "上海世纪大道中转站",
    location: [121.5447, 31.22249] as [number, number],
    sortingHours: 3.5,
  },
  {
    id: "h3",
    name: "北京三里屯中转站",
    location: [116.4551, 39.9371] as [number, number],
    sortingHours: 4,
  },
  {
    id: "h4",
    name: "深圳世界之窗中转站",
    location: [113.9937, 22.5428] as [number, number],
    sortingHours: 2.5,
  },
  {
    id: "h5",
    name: "南京新街口中转站",
    location: [118.78, 32.05] as [number, number],
    sortingHours: 3,
  },
];

// 模拟订单数据
const orderData: OrderItem[] = [
  {
    key: "1",
    orderNo: "ORD-001",
    receiver: "王小明",
    address: "浙江省杭州市西湖区文三路123号阿里巴巴西溪园区A座",
    amount: 299.0,
    status: "pending",
    createTime: "2025-11-28 14:30",
    startLngLat: [120.023164, 30.281008], // 杭州仓
    endLngLat: [120.21201, 30.2084], // 滨江区
  },
  {
    key: "2",
    orderNo: "ORD-002",
    receiver: "李雷",
    address: "上海市浦东新区张江高科地铁站附近创业大厦B栋502室",
    amount: 1200.0,
    status: "shipping",
    createTime: "2025-11-27 09:15",
    startLngLat: [120.023164, 30.281008], // 杭州仓
    endLngLat: [121.593477, 31.204327], // 张江
  },
  {
    key: "3",
    orderNo: "ORD-003",
    receiver: "韩梅梅",
    address: "北京市朝阳区望京SOHO中心T3座",
    amount: 89.5,
    status: "completed",
    createTime: "2025-11-25 16:45",
    startLngLat: [120.023164, 30.281008], // 杭州仓
    endLngLat: [116.48105, 39.996794], // 望京SOHO
  },
  {
    key: "4",
    orderNo: "ORD-004",
    receiver: "张伟",
    address: "广东省深圳市南山区科技园",
    amount: 450.0,
    status: "pending",
    createTime: "2025-11-28 10:20",
    startLngLat: [120.023164, 30.281008], // 杭州仓
    endLngLat: [113.953086, 22.540989], // 科技园
  },
  {
    key: "5",
    orderNo: "ORD-005",
    receiver: "赵芳",
    address: "江苏省南京市鼓楼区中山北路",
    amount: 320.0,
    status: "shipping",
    createTime: "2025-11-26 15:00",
    startLngLat: [120.023164, 30.281008], // 杭州仓
    endLngLat: [118.767413, 32.061507], // 中山北路
  },
];

// 统计卡片
const stats = [
  {
    label: "待发货订单",
    value: 2,
    color: "#e6f7ff",
    textColor: "#1890ff",
    status: "pending" as StatusType,
  },
  {
    label: "运输中",
    value: 2,
    color: "#fffbe6",
    textColor: "#faad14",
    status: "shipping" as StatusType,
  },
  {
    label: "已完成",
    value: 1,
    color: "#f0f9ff",
    textColor: "#52c41a",
    status: "completed" as StatusType,
  },
  {
    label: "总交易额 (GMV)",
    value: "¥45,200",
    color: "#f5f5f5",
    textColor: "#000",
    status: null,
  },
];

// ✅ 日期范围判断函数（只接受 [string, string]）
const isDateInRange = (
  dateStr: string,
  range: [string, string] | null
): boolean => {
  if (!range || !range[0] || !range[1]) return true;
  const target = new Date(dateStr);
  const start = new Date(range[0]);
  const end = new Date(range[1]);
  end.setHours(23, 59, 59, 999); // 包含整天
  return target >= start && target <= end;
};

const OrderDispatchPage: React.FC = () => {
  const [form] = Form.useForm();
  const [visible, setVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<OrderItem | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<StatusType | null>(null);

  // 发货逻辑
  const handleDispatchClick = (record: OrderItem) => {
    setCurrentOrder(record);
    setVisible(true);
  };

  const handleConfirmDispatch = () => {
    alert(`✅ 已成功发货订单：${currentOrder?.orderNo}`);
    setVisible(false);
    setCurrentOrder(null);
  };

  const handleCancel = () => {
    setVisible(false);
  };

  // 表单提交
  const onFinish = () => {
    // 过滤由 useMemo 自动处理
  };

  // 重置：清空表单 + 清除状态筛选
  const handleReset = () => {
    form.resetFields();
    setSelectedStatus(null);
  };

  // ✅ 联动过滤逻辑（使用方法二：提前转换日期）
  const filteredOrders = useMemo(() => {
    const values = form.getFieldsValue();

    // 提取并清理表单值
    const orderNo = values.orderNo?.trim() || "";
    const formStatus = values.status || "";
    const minAmount =
      values.minAmount !== undefined ? Number(values.minAmount) : null;
    const maxAmount =
      values.maxAmount !== undefined ? Number(values.maxAmount) : null;

    // ✅ 安全转换日期范围：Dayjs[] → [string, string]
    let dateRange: [string, string] | null = null;
    if (values.dateRange && values.dateRange[0] && values.dateRange[1]) {
      dateRange = [
        values.dateRange[0].format("YYYY-MM-DD"),
        values.dateRange[1].format("YYYY-MM-DD"),
      ];
    }

    return orderData.filter((item) => {
      // 1. 卡片状态筛选
      if (selectedStatus && item.status !== selectedStatus) return false;

      // 2. 表单：订单号
      if (orderNo && !item.orderNo.includes(orderNo)) return false;

      // 3. 表单：状态（兼容性，通常被卡片覆盖）
      if (formStatus && item.status !== formStatus) return false;

      // 4. 表单：创建时间（✅ 安全传入 [string, string]）
      if (!isDateInRange(item.createTime, dateRange)) return false;

      // 5. 表单：金额范围
      if (minAmount !== null && item.amount < minAmount) return false;
      if (maxAmount !== null && item.amount > maxAmount) return false;

      return true;
    });
  }, [selectedStatus, form]); // form 实例稳定，但 getFieldsValue 实时读取

  // 表格列配置
  const columns = [
    {
      title: "订单号",
      dataIndex: "orderNo",
      key: "orderNo",
    },
    {
      title: "订单创建时间",
      dataIndex: "createTime",
      key: "createTime",
      width: 160,
    },
    {
      title: "收件人",
      dataIndex: "receiver",
      key: "receiver",
    },
    {
      title: "收货地址 (悬浮查看完整)",
      dataIndex: "address",
      key: "address",
      render: (text: string) => (
        <Tooltip title={text}>
          <span>{text}</span>
        </Tooltip>
      ),
    },
    {
      title: "金额",
      dataIndex: "amount",
      key: "amount",
      render: (value: number) => `¥${value.toFixed(2)}`,
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (status: StatusType) => (
        <Tag color={statusMap[status].color}>{statusMap[status].label}</Tag>
      ),
    },
    {
      title: "操作",
      key: "action",
      render: (_: unknown, record: OrderItem) => (
        <Space size="middle">
          <a href="#">详情</a>
          {record.status === "pending" && (
            <Button
              type="primary"
              icon={<TruckOutlined />}
              size="small"
              onClick={() => handleDispatchClick(record)}
            >
              发货
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {stats.map((item, index) => (
          <Col key={index} span={6}>
            <Card
              hoverable
              bodyStyle={{ padding: 16 }}
              style={{
                backgroundColor: item.color,
                border: "none",
                borderRadius: 8,
                cursor: item.status ? "pointer" : "default",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                transform:
                  selectedStatus === item.status ? "scale(1.02)" : "none",
                transition: "transform 0.2s",
              }}
              onClick={() => {
                if (item.status) {
                  setSelectedStatus(item.status);
                }
              }}
            >
              <div style={{ fontSize: 14, color: "#666", marginBottom: 8 }}>
                {item.label}
              </div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: "bold",
                  color: item.textColor,
                }}
              >
                {item.value}
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 搜索表单 */}
      <Card title="搜索订单" style={{ marginBottom: 24 }}>
        <Form form={form} layout="vertical" colon={false} onFinish={onFinish}>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item label="订单号" name="orderNo">
                <Input placeholder="输入订单号" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="状态" name="status">
                <Select placeholder="全部">
                  <Select.Option value="">全部</Select.Option>
                  <Select.Option value="pending">待发货</Select.Option>
                  <Select.Option value="shipping">运输中</Select.Option>
                  <Select.Option value="completed">已完成</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="创建时间" name="dateRange">
                <DatePicker.RangePicker
                  style={{ width: "100%" }}
                  placeholder={["开始日期", "结束日期"]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item label="最小金额" name="minAmount">
                <Input prefix="¥" placeholder="0" type="number" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="最大金额" name="maxAmount">
                <Input prefix="¥" placeholder="10000" type="number" />
              </Form.Item>
            </Col>
          </Row>
          <Row justify="end" style={{ marginTop: 16 }}>
            <Space>
              <Button onClick={handleReset}>重置</Button>
              <Button
                type="primary"
                icon={<SearchOutlined />}
                htmlType="submit"
              >
                查询
              </Button>
            </Space>
          </Row>
        </Form>
      </Card>

      {/* 订单表格 */}
      <Card title="订单列表">
        <Table
          dataSource={filteredOrders}
          columns={columns}
          rowKey="key"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* 发货确认弹窗 */}
      {currentOrder && (
        <DispatchConfirmModal
          open={visible}
          onCancel={handleCancel}
          onConfirm={handleConfirmDispatch}
          orderNo={currentOrder.orderNo}
          fromAddress="浙江省杭州市余杭区菜鸟物流园A区"
          toAddress={currentOrder.address}
          distance="1240km"
          duration="14小时"
          startLngLat={currentOrder.startLngLat || [116.397428, 39.90923]}
          endLngLat={currentOrder.endLngLat || [116.417428, 39.92923]}
          availableHubs={TRANSIT_HUBS}
        />
      )}
    </div>
  );
};

export default OrderDispatchPage;
