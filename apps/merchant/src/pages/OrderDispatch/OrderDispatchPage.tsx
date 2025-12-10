import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  message,
  TableProps,
} from "antd";
import { SearchOutlined, TruckOutlined } from "@ant-design/icons";
import {
  orderService,
  type Order,
  type OrderStatus,
} from "../../services/order";
import { prepareShippingData } from "../../utils/shipping";

// =============== 类型定义 ===============
type StatusType = "pending" | "shipping" | "completed";

// 导入发货确认弹窗
import DispatchConfirmModal from "./DispatchConfirmModal";

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

interface QueryParams {
  page: number;
  pageSize: number;
  userId?: string;
  merchantId?: string;
  status?: string;
  searchQuery?: string;
  startTime?: string;
  endTime?: string;
  sortBy?: string;
  sortDirection?: "ASC" | "DESC";
}

interface FormValues {
  orderNo?: string;
  status?: string;
  dateRange?: [unknown, unknown] | null;
}

// =============== 常量 ===============
const statusMap: Record<StatusType, { label: string; color: string }> = {
  pending: { label: "待发货", color: "orange" },
  shipping: { label: "运输中", color: "blue" },
  completed: { label: "已完成", color: "green" },
};

// =============== 样式常量 ===============
const styles = {
  pageContainer: { padding: 16 },
  statsRow: { marginBottom: 16 },
  statCard: {
    base: {
      border: "none",
      borderRadius: 8,
      boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
      transition: "transform 0.2s",
    },
    body: { padding: 12 },
    label: { fontSize: 13, color: "#666", marginBottom: 6 },
    value: { fontSize: 22, fontWeight: "bold" as const },
  },
  searchCard: { marginBottom: 16 },
  formActions: { marginTop: 12 },
  datePicker: { width: "100%" },
} as const;

const mapBackendStatus = (status: OrderStatus): StatusType => {
  if (status === "pending") return "pending";
  if (status === "shipping" || status === "pickedUp" || status === "arrived")
    return "shipping";
  if (status === "delivered") return "completed";
  return "pending";
};

const formatTime = (isoStr: string): string => {
  return new Date(isoStr).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
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
  {
    id: "h6",
    name: "广州天河中转站",
    location: [113.3311, 23.1375] as [number, number],
    sortingHours: 2.5,
  },
  {
    id: "h7",
    name: "成都春熙路中转站",
    location: [104.0815, 30.6624] as [number, number],
    sortingHours: 3,
  },
  {
    id: "h8",
    name: "武汉光谷中转站",
    location: [114.4024, 30.5064] as [number, number],
    sortingHours: 2.5,
  },
  {
    id: "h9",
    name: "西安钟楼中转站",
    location: [108.9398, 34.3416] as [number, number],
    sortingHours: 3.5,
  },
  {
    id: "h10",
    name: "天津滨海中转站",
    location: [117.2008, 39.0842] as [number, number],
    sortingHours: 3,
  },
  {
    id: "h11",
    name: "苏州工业园区中转站",
    location: [120.6663, 31.3089] as [number, number],
    sortingHours: 2,
  },
  {
    id: "h12",
    name: "重庆解放碑中转站",
    location: [106.5708, 29.563] as [number, number],
    sortingHours: 3,
  },
  {
    id: "h13",
    name: "青岛五四广场中转站",
    location: [120.3826, 36.0671] as [number, number],
    sortingHours: 2.5,
  },
  {
    id: "h14",
    name: "大连星海广场中转站",
    location: [121.5935, 38.886] as [number, number],
    sortingHours: 3,
  },
  {
    id: "h15",
    name: "郑州二七广场中转站",
    location: [113.6654, 34.7579] as [number, number],
    sortingHours: 2.5,
  },
];

// =============== 主组件 ===============
function OrderDispatchPage() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [visible, setVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<OrderItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [selectedStatus, setSelectedStatus] = useState<StatusType | null>(null);
  const [dynamicStats, setDynamicStats] = useState([
    {
      label: "待发货订单",
      value: "—",
      color: "#e6f7ff",
      textColor: "#1890ff",
      status: "pending" as StatusType,
    },
    {
      label: "运输中",
      value: "—",
      color: "#fffbe6",
      textColor: "#faad14",
      status: "shipping" as StatusType,
    },
    {
      label: "已完成",
      value: "—",
      color: "#f0f9ff",
      textColor: "#52c41a",
      status: "completed" as StatusType,
    },
    {
      label: "总交易额 (GMV)",
      value: "¥—",
      color: "#f5f5f5",
      textColor: "#000",
      status: null,
    },
  ]);

  // =============== 构建查询参数 ===============
  const buildQueryParams = (
    values: FormValues,
    page: number,
    pageSize: number
  ): QueryParams => {
    const params: QueryParams = {
      page,
      pageSize,
      merchantId: "10001",
    };

    if (values.status) {
      params.status = values.status;
    }
    if (values.orderNo?.trim()) {
      params.searchQuery = values.orderNo.trim();
    }

    // 处理日期范围：DatePicker 返回的是 dayjs 对象数组（或 null）
    const [start, end] = values.dateRange || [];
    if (start && typeof start === "object" && "isValid" in start) {
      const startDayjs = start as unknown as {
        isValid: () => boolean;
        format: (format: string) => string;
      };
      if (startDayjs.isValid()) {
        params.startTime = startDayjs.format("YYYY-MM-DD");
      }
    }
    if (end && typeof end === "object" && "isValid" in end) {
      const endDayjs = end as unknown as {
        isValid: () => boolean;
        format: (format: string) => string;
      };
      if (endDayjs.isValid()) {
        params.endTime = endDayjs.format("YYYY-MM-DD");
      }
    }

    params.sortBy = "createTime";
    params.sortDirection = "DESC";

    return params;
  };

  // =============== 获取统计数据 ===============
  const fetchStatistics = async () => {
    try {
      const statistics = await orderService.getOrderStatistics();
      setDynamicStats([
        {
          label: "待发货订单",
          value: String(statistics.pendingCount),
          color: "#e6f7ff",
          textColor: "#1890ff",
          status: "pending" as StatusType,
        },
        {
          label: "运输中",
          value: String(statistics.shippingCount),
          color: "#fffbe6",
          textColor: "#faad14",
          status: "shipping" as StatusType,
        },
        {
          label: "已完成",
          value: String(statistics.completedCount),
          color: "#f0f9ff",
          textColor: "#52c41a",
          status: "completed" as StatusType,
        },
        {
          label: "总交易额 (GMV)",
          value: `¥${statistics.totalGMV.toFixed(2)}`,
          color: "#f5f5f5",
          textColor: "#000",
          status: null,
        },
      ]);
    } catch (error) {
      console.error("获取统计数据失败:", error);
      // 统计数据获取失败不影响订单列表显示，只记录错误
    }
  };

  // =============== 请求订单 ===============
  const fetchOrders = async (params: QueryParams) => {
    setLoading(true);
    try {
      const result = await orderService.getOrders({
        page: params.page,
        pageSize: params.pageSize,
        userId: params.userId,
        status: params.status,
        searchQuery: params.searchQuery,
        sortBy: params.sortBy as
          | "createTime"
          | "amount"
          | "status"
          | "recipientName",
        sortDirection: params.sortDirection,
      });

      const orders: OrderItem[] = result.orders.map((order: Order) => ({
        key: order.id,
        orderNo: order.id,
        receiver: order.recipientName,
        address: order.recipientAddress,
        amount: order.amount,
        status: mapBackendStatus(order.status),
        createTime: formatTime(order.createTime),
        startLngLat: order.routePath?.[0] as [number, number] | undefined,
        endLngLat: order.recipientCoords as [number, number],
      }));

      setOrders(orders);
      setTotal(result.totalCount);
    } catch (error) {
      console.error("API Error:", error);
      message.error("获取订单列表失败");
    } finally {
      setLoading(false);
    }
  };

  // =============== 初始加载 ===============
  useEffect(() => {
    // 同时获取订单列表和统计数据
    fetchOrders(buildQueryParams({}, 1, 10));
    fetchStatistics();
  }, []);

  // =============== 表单提交 ===============
  function onFinish(values: FormValues) {
    setPagination({ current: 1, pageSize: 10 });
    const params = buildQueryParams(values, 1, 10);
    fetchOrders(params);
  }

  const handleReset = () => {
    form.resetFields();
    setPagination({ current: 1, pageSize: 10 });
    fetchOrders(buildQueryParams({}, 1, 10));
  };

  // =============== 表格变化（分页 + 排序） ===============
  const handleTableChange: TableProps<OrderItem>["onChange"] = (
    paginationConfig,
    _filters,
    sorter
  ) => {
    const page = paginationConfig.current || 1;
    const pageSize = paginationConfig.pageSize || 10;
    setPagination({ current: page, pageSize });

    const values = form.getFieldsValue();

    let sortBy: string | undefined;
    let sortDirection: "ASC" | "DESC" | undefined;

    // 🔧 安全处理 sorter：可能是单个对象或数组
    const sortArray = Array.isArray(sorter) ? sorter : [sorter];
    const primarySort = sortArray.find((s) => s && s.order);

    if (primarySort?.columnKey) {
      sortBy = String(primarySort.columnKey);
      sortDirection = primarySort.order === "ascend" ? "ASC" : "DESC";
    } else if (primarySort?.field) {
      sortBy = String(primarySort.field);
      sortDirection = primarySort.order === "ascend" ? "ASC" : "DESC";
    }

    const params = buildQueryParams(values, page, pageSize);
    if (sortBy) {
      params.sortBy = sortBy;
      params.sortDirection = sortDirection;
    }

    fetchOrders(params);
  };

  // =============== 发货操作 ===============
  const handleDispatchClick = (record: OrderItem) => {
    setCurrentOrder(record);
    setVisible(true);
  };

  const handleConfirmDispatch = async (
    routePath: [number, number][],
    ruleId: number
  ) => {
    if (!currentOrder) return;

    setLoading(true);
    try {
      const shippingData = prepareShippingData(routePath, ruleId);
      await orderService.shipOrder(currentOrder.orderNo, shippingData);

      message.success(` 已成功发货订单：${currentOrder.orderNo}`);
      setVisible(false);
      setCurrentOrder(null);

      const values = form.getFieldsValue();
      // 刷新订单列表和统计数据
      fetchOrders(
        buildQueryParams(values, pagination.current, pagination.pageSize)
      );
      fetchStatistics();
    } catch (error) {
      console.error("发货失败:", error);
      const errorMessage =
        error instanceof Error ? error.message : "发货失败，请重试";
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setVisible(false);
  };

  // =============== 表格列 ===============
  const columns = [
    {
      title: "订单号",
      dataIndex: "orderNo",
      key: "orderNo",
      ellipsis: true,
    },
    {
      title: "订单创建时间",
      dataIndex: "createTime",
      key: "createTime",
      width: 150,
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
      sorter: true,
      columnKey: "amount", // 用于排序识别
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
          <a onClick={() => navigate(`/OrderDetail/${record.orderNo}`)}>详情</a>
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

  // =============== 渲染 ===============
  return (
    <div style={styles.pageContainer}>
      {/* 统计卡片 */}
      <Row gutter={[12, 12]} style={styles.statsRow}>
        {dynamicStats.map((item, index) => (
          <Col key={index} span={6}>
            <Card
              styles={{ body: styles.statCard.body }}
              style={{
                ...styles.statCard.base,
                backgroundColor: item.color,
                cursor: item.status ? "pointer" : "default",
                transform:
                  selectedStatus === item.status ? "scale(1.02)" : "none",
              }}
              onClick={() => {
                if (item.status) {
                  setSelectedStatus(item.status);
                }
              }}
            >
              <div style={styles.statCard.label}>{item.label}</div>
              <div
                style={{
                  ...styles.statCard.value,
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
      <Card
        title="搜索订单"
        style={styles.searchCard}
        bodyStyle={{ padding: 16 }}
      >
        <Form form={form} layout="vertical" colon={false} onFinish={onFinish}>
          <Row gutter={12}>
            <Col span={6}>
              <Form.Item label="关键词（订单/收件人/地址）" name="orderNo">
                <Input placeholder="输入关键词" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="状态" name="status">
                <Select placeholder="全部">
                  <Select.Option value="">全部</Select.Option>
                  <Select.Option value="pending">待发货</Select.Option>
                  <Select.Option value="shipping">运输中</Select.Option>
                  <Select.Option value="delivered">已完成</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="创建时间" name="dateRange">
                <DatePicker.RangePicker
                  style={styles.datePicker}
                  placeholder={["开始日期", "结束日期"]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row justify="end" style={styles.formActions}>
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
      <Card title="订单列表" bodyStyle={{ padding: 16 }}>
        <Table
          dataSource={orders}
          columns={columns}
          rowKey="key"
          loading={loading}
          size="small"
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50"],
            size: "small",
          }}
          onChange={handleTableChange}
        />
      </Card>

      {/* 发货弹窗 */}
      {currentOrder && (
        <DispatchConfirmModal
          open={visible}
          onCancel={handleCancel}
          onConfirm={handleConfirmDispatch}
          orderNo={currentOrder.orderNo}
          fromAddress="浙江省杭州市余杭区菜鸟物流园A区"
          toAddress={currentOrder.address}
          startLngLat={currentOrder.startLngLat || [116.397428, 39.90923]}
          endLngLat={currentOrder.endLngLat || [116.417428, 39.92923]}
          availableHubs={TRANSIT_HUBS}
          defaultRuleId={101}
        />
      )}
    </div>
  );
}

export default OrderDispatchPage;
