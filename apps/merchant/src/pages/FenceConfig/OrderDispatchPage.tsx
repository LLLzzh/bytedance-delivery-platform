import React, { useState, useEffect } from 'react';
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
} from 'antd';
import { SearchOutlined, PlusCircleOutlined, TruckOutlined } from '@ant-design/icons';
import axios from 'axios';

// 假设你有这个组件
import DispatchConfirmModal from './DispatchConfirmModal';

// =============== 类型定义 ===============
type StatusType = 'pending' | 'shipping' | 'completed';

interface OrderItem {
  key: string;
  orderNo: string;
  receiver: string;
  address: string;
  amount: number;
  status: StatusType;
  createTime: string;
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
  sortDirection?: 'ASC' | 'DESC';
}

// =============== 常量 ===============
const statusMap: Record<StatusType, { label: string; color: string }> = {
  pending: { label: '待发货', color: 'orange' },
  shipping: { label: '运输中', color: 'blue' },
  completed: { label: '已完成', color: 'green' },
};

const mapBackendStatus = (status: string): StatusType => {
  if (status === 'pending') return 'pending';
  if (status === 'shipping') return 'shipping';
  return 'completed';
};

const formatTime = (isoStr: string): string => {
  return new Date(isoStr).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

// =============== 主组件 ===============
const OrderDispatchPage: React.FC = () => {
  const [form] = Form.useForm();
  const [visible, setVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<OrderItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });

  // =============== 构建查询参数 ===============
  const buildQueryParams = (
    values: any,
    page: number,
    pageSize: number
  ): QueryParams => {
    const params: QueryParams = {
      page,
      pageSize,
      userId: 'user_12345',
      merchantId: '10001',
    };

    if (values.status) {
      params.status = values.status;
    }
    if (values.orderNo?.trim()) {
      params.searchQuery = values.orderNo.trim();
    }

    // 处理日期范围：DatePicker 返回的是 moment 对象数组（或 null）
    const [start, end] = values.dateRange || [];
    if (start && start.isValid) {
      params.startTime = start.format('YYYY-MM-DD');
    }
    if (end && end.isValid) {
      params.endTime = end.format('YYYY-MM-DD');
    }

    params.sortBy = 'createTime';
    params.sortDirection = 'DESC';

    return params;
  };

  // =============== 请求订单 ===============
  const fetchOrders = async (params: QueryParams) => {
    setLoading(true);
    try {
      const response = await axios.get('/api/v1/orders', { params });
      if (response.data.success) {
        const orders: OrderItem[] = response.data.orders.map((item: any) => ({
          key: item.id,
          orderNo: item.id,
          receiver: item.recipientName,
          address: item.recipientAddress,
          amount: parseFloat(item.amount) || 0,
          status: mapBackendStatus(item.status),
          createTime: formatTime(item.createTime),
        }));
        setOrders(orders);
        setTotal(response.data.totalCount ?? response.data.orders.length);
      } else {
        message.error('获取订单失败');
      }
    } catch (error) {
      console.error('API Error:', error);
      message.error('网络错误，请检查控制台');
    } finally {
      setLoading(false);
    }
  };

  // =============== 初始加载 ===============
  useEffect(() => {
    fetchOrders(buildQueryParams({}, 1, 10));
  }, []);

  // =============== 表单提交 ===============
  const onFinish = (values: any) => {
    setPagination({ current: 1, pageSize: 10 });
    const params = buildQueryParams(values, 1, 10);
    fetchOrders(params);
  };

  const handleReset = () => {
    form.resetFields();
    setPagination({ current: 1, pageSize: 10 });
    fetchOrders(buildQueryParams({}, 1, 10));
  };

  // =============== 表格变化（分页 + 排序） ===============
  const handleTableChange: TableProps<OrderItem>['onChange'] = (
    paginationConfig,
    filters,
    sorter
  ) => {
    const page = paginationConfig.current || 1;
    const pageSize = paginationConfig.pageSize || 10;
    setPagination({ current: page, pageSize });

    const values = form.getFieldsValue();

    let sortBy: string | undefined;
    let sortDirection: 'ASC' | 'DESC' | undefined;

    // 🔧 安全处理 sorter：可能是单个对象或数组
    const sortArray = Array.isArray(sorter) ? sorter : [sorter];
    const primarySort = sortArray.find(s => s && s.order);

    if (primarySort?.columnKey) {
      sortBy = String(primarySort.columnKey);
      sortDirection = primarySort.order === 'ascend' ? 'ASC' : 'DESC';
    } else if (primarySort?.field) {
      sortBy = String(primarySort.field);
      sortDirection = primarySort.order === 'ascend' ? 'ASC' : 'DESC';
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

  const handleConfirmDispatch = () => {
    if (currentOrder) {
      message.success(`✅ 已成功发货订单：${currentOrder.orderNo}`);
    }
    setVisible(false);
    setCurrentOrder(null);

    const values = form.getFieldsValue();
    fetchOrders(buildQueryParams(values, pagination.current, pagination.pageSize));
  };

  const handleCancel = () => {
    setVisible(false);
  };

  // =============== 统计卡片 ===============
  const dynamicStats = [
    { label: '待发货订单', value: '—', color: '#e6f7ff', textColor: '#1890ff' },
    { label: '运输中', value: '—', color: '#fffbe6', textColor: '#faad14' },
    { label: '已完成', value: '—', color: '#f0f9ff', textColor: '#52c41a' },
    { label: '总交易额 (GMV)', value: '¥—', color: '#f5f5f5', textColor: '#000' },
  ];

  // =============== 表格列 ===============
  const columns = [
    {
      title: '订单号',
      dataIndex: 'orderNo',
      key: 'orderNo',
      ellipsis: true,
    },
    {
      title: '订单创建时间',
      dataIndex: 'createTime',
      key: 'createTime',
      width: 160,
    },
    {
      title: '收件人',
      dataIndex: 'receiver',
      key: 'receiver',
    },
    {
      title: '收货地址',
      dataIndex: 'address',
      key: 'address',
      render: (text: string) => (
        <Tooltip title={text}>
          <span>{text}</span>
        </Tooltip>
      ),
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (value: number) => `¥${value.toFixed(2)}`,
      sorter: true,
      columnKey: 'amount', // 用于排序识别
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: StatusType) => (
        <Tag color={statusMap[status].color}>{statusMap[status].label}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: OrderItem) => (
        <Space size="middle">
          <a href="#">详情</a>
          {record.status === 'pending' && (
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
    <div style={{ padding: 24 }}>
      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {dynamicStats.map((item, index) => (
          <Col key={index} span={6}>
            <Card
              bodyStyle={{ padding: 16 }}
              style={{
                backgroundColor: item.color,
                border: 'none',
                borderRadius: 8,
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}
            >
              <div style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>
                {item.label}
              </div>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: item.textColor }}>
                {item.value}
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 搜索表单 */}
      <Card
        title="搜索订单"
        style={{ marginBottom: 24 }}
        extra={
          <Button type="primary" icon={<PlusCircleOutlined />}>
            + 新建模拟订单
          </Button>
        }
      >
        <Form form={form} layout="vertical" colon={false} onFinish={onFinish}>
          <Row gutter={16}>
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
                  style={{ width: '100%' }}
                  placeholder={['开始日期', '结束日期']}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row justify="end" style={{ marginTop: 16 }}>
            <Space>
              <Button onClick={handleReset}>重置</Button>
              <Button type="primary" icon={<SearchOutlined />} htmlType="submit">
                查询
              </Button>
            </Space>
          </Row>
        </Form>
      </Card>

      {/* 订单表格 */}
      <Card title="订单列表">
        <Table
          dataSource={orders}
          columns={columns}
          rowKey="key"
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
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
          distance="1240km"
          duration="14小时"
        />
      )}
    </div>
  );
};

export default OrderDispatchPage;