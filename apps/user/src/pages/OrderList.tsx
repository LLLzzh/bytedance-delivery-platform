import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Input,
  Tag,
  Typography,
  Button,
  Layout,
  Spin,
  Empty,
  message,
  Tabs,
  Drawer,
  Space,
  Radio,
  Dropdown,
} from "antd";
import {
  SearchOutlined,
  FilterOutlined,
  MoreOutlined,
  EnvironmentOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import { PullToRefresh } from "antd-mobile";
import { useNavigate } from "react-router-dom";
import { orderService, Order, OrderStatus } from "../services/order";
import CreateOrderModal from "../components/CreateOrderModal";

const { Text } = Typography;
const { Header, Content } = Layout;

// Tab 类型定义
type TabKey =
  | "all"
  | "pending"
  | "shipping"
  | "arrived"
  | "delivered"
  | "cancelled";

// Tab 配置
const tabItems = [
  { key: "all", label: "全部" },
  { key: "pending", label: "待发货" },
  { key: "shipping", label: "运输中" },
  { key: "arrived", label: "待收货" },
  { key: "delivered", label: "已完成" },
  { key: "cancelled", label: "已取消" },
];

// 筛选选项
interface FilterOptions {
  sortBy?: "createTime" | "amount";
  sortDirection?: "ASC" | "DESC";
}

// 分页配置
const PAGE_SIZE = 5; // 每页加载数量（小数量便于测试触底加载）

const OrderList: React.FC = () => {
  const [searchText, setSearchText] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({});
  const [createOrderVisible, setCreateOrderVisible] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    hasMore: true,
  });
  const navigate = useNavigate();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const observerTargetRef = useRef<HTMLDivElement>(null);

  // 根据 Tab 获取对应的订单状态
  const getStatusByTab = (tab: TabKey): OrderStatus | undefined => {
    switch (tab) {
      case "pending":
        return OrderStatus.Pending;
      case "shipping":
        return OrderStatus.Shipping;
      case "arrived":
        return OrderStatus.Arrived;
      case "delivered":
        return OrderStatus.Delivered;
      case "cancelled":
        return OrderStatus.Cancelled;
      default:
        return undefined; // "all" 不筛选状态
    }
  };

  // 加载订单列表
  const loadOrders = useCallback(
    async (page: number = 1, append: boolean = false) => {
      try {
        if (append) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }

        const status = getStatusByTab(activeTab);
        const result = await orderService.getOrders({
          page,
          pageSize: PAGE_SIZE,
          status: status,
          searchQuery: searchText || undefined,
          sortBy: filterOptions.sortBy,
          sortDirection: filterOptions.sortDirection,
        });

        if (result.success) {
          const newOrders = result.orders || [];
          if (append) {
            // 追加数据
            setOrders((prev) => [...prev, ...newOrders]);
          } else {
            // 替换数据
            setOrders(newOrders);
          }

          // 更新分页信息
          setPagination({
            current: page,
            pageSize: PAGE_SIZE,
            total: result.totalCount || 0,
            hasMore:
              newOrders.length === PAGE_SIZE &&
              (result.totalCount || 0) > page * PAGE_SIZE,
          });
        } else {
          message.error("获取订单列表失败");
        }
      } catch (error) {
        console.error("Failed to load orders:", error);
        message.error("获取订单列表失败，请稍后重试");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [activeTab, searchText, filterOptions]
  );

  // 初始加载和依赖变化时重新加载
  useEffect(() => {
    setOrders([]);
    setPagination({
      current: 1,
      pageSize: PAGE_SIZE,
      total: 0,
      hasMore: true,
    });
    loadOrders(1, false);
  }, [
    activeTab,
    searchText,
    filterOptions.sortBy,
    filterOptions.sortDirection,
  ]);

  // 加载更多（触底加载）
  const loadMore = useCallback(() => {
    if (loadingMore || !pagination.hasMore) {
      return;
    }
    loadOrders(pagination.current + 1, true);
  }, [pagination, loadingMore, loadOrders]);

  // Intersection Observer 用于检测触底
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (
          target.isIntersecting &&
          pagination.hasMore &&
          !loadingMore &&
          !loading
        ) {
          loadMore();
        }
      },
      {
        root: scrollContainerRef.current,
        rootMargin: "100px", // 提前100px开始加载
        threshold: 0.1,
      }
    );

    const currentTarget = observerTargetRef.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [pagination.hasMore, loadingMore, loading, loadMore]);

  // Tab 切换
  const handleTabChange = (key: string) => {
    setActiveTab(key as TabKey);
  };

  // 搜索
  const handleSearch = (value: string) => {
    setSearchText(value);
  };

  // 应用筛选
  const handleApplyFilter = (options: FilterOptions) => {
    setFilterOptions(options);
    setFilterVisible(false);
  };

  // 处理新建订单成功
  const handleCreateOrderSuccess = () => {
    // 重新加载订单列表
    loadOrders(1, false);
  };

  // 下拉刷新处理
  const handleRefresh = useCallback(async () => {
    try {
      const status = getStatusByTab(activeTab);
      const result = await orderService.getOrders({
        page: 1,
        pageSize: PAGE_SIZE,
        status: status,
        searchQuery: searchText || undefined,
        sortBy: filterOptions.sortBy,
        sortDirection: filterOptions.sortDirection,
      });

      if (result.success) {
        const newOrders = result.orders || [];
        setOrders(newOrders);
        setPagination({
          current: 1,
          pageSize: PAGE_SIZE,
          total: result.totalCount || 0,
          hasMore:
            newOrders.length === PAGE_SIZE &&
            (result.totalCount || 0) > PAGE_SIZE,
        });
        message.success("刷新成功");
      } else {
        message.error("刷新失败");
      }
    } catch (error) {
      console.error("Failed to refresh orders:", error);
      message.error("刷新失败，请稍后重试");
      throw error; // 抛出错误以便 PullToRefresh 知道刷新失败
    }
  }, [activeTab, searchText, filterOptions]);

  // 三个点菜单项
  const moreMenuItems: MenuProps["items"] = [
    {
      key: "createOrder",
      label: "新建订单",
      icon: <PlusOutlined />,
      onClick: () => {
        setCreateOrderVisible(true);
      },
    },
  ];

  // 获取状态显示文本和颜色
  const getStatusInfo = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.Pending:
        return { text: "待发货", color: "orange" };
      case OrderStatus.PickedUp:
        return { text: "已取件", color: "processing" };
      case OrderStatus.Shipping:
        return { text: "运输中", color: "processing" };
      case OrderStatus.Arrived:
        return { text: "待收货", color: "warning" };
      case OrderStatus.Delivered:
        return { text: "已完成", color: "success" };
      case OrderStatus.Cancelled:
        return { text: "已取消", color: "default" };
      default:
        return { text: status, color: "default" };
    }
  };

  // 格式化订单号（显示后8位）
  const formatOrderNo = (orderId: string) => {
    return orderId.length > 8 ? `...${orderId.slice(-8)}` : orderId;
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
    });
  };

  return (
    <Layout
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#fff",
      }}
    >
      {/* 顶部导航栏 */}
      <Header
        style={{
          background: "#fff",
          padding: "0 12px",
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
          borderBottom: "1px solid #f0f0f0",
          height: "44px",
          lineHeight: "44px",
        }}
      >
        <div
          style={{ flex: 1, display: "flex", alignItems: "center", gap: "8px" }}
        >
          <Input
            placeholder="搜索我的订单"
            prefix={<SearchOutlined style={{ color: "#999" }} />}
            value={searchText}
            onChange={(e) => handleSearch(e.target.value)}
            onPressEnter={(e) => handleSearch(e.currentTarget.value)}
            allowClear
            style={{
              flex: 1,
              borderRadius: "16px",
              background: "#f5f5f5",
              border: "none",
            }}
          />
        </div>
        <Space style={{ marginLeft: "8px" }}>
          <Button
            type="text"
            icon={<FilterOutlined />}
            onClick={() => setFilterVisible(true)}
            style={{ padding: 0 }}
          />
          <Dropdown menu={{ items: moreMenuItems }} trigger={["click"]}>
            <Button
              type="text"
              icon={<MoreOutlined />}
              style={{ padding: 0 }}
            />
          </Dropdown>
        </Space>
      </Header>

      {/* Tab 切换 */}
      <div
        style={{
          background: "#fff",
          flexShrink: 0,
          borderBottom: "1px solid #f0f0f0",
        }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          items={tabItems}
          style={{ margin: 0 }}
          tabBarStyle={{
            margin: 0,
            padding: "0 12px",
            borderBottom: "none",
          }}
          tabBarGutter={24}
          indicator={{
            size: (origin) => origin - 16,
          }}
        />
      </div>

      {/* 订单列表内容 - 可滚动，支持虚拟列表和下拉刷新 */}
      <Content
        ref={scrollContainerRef}
        style={{
          flex: 1,
          overflowY: "auto",
          background: "#f5f5f5",
          position: "relative",
        }}
      >
        <PullToRefresh
          onRefresh={handleRefresh}
          renderText={(status) => {
            switch (status) {
              case "pulling":
                return "下拉刷新";
              case "canRelease":
                return "松开刷新";
              case "refreshing":
                return "正在刷新...";
              default:
                return "";
            }
          }}
        >
          <Spin spinning={loading && orders.length === 0}>
            {loading && orders.length === 0 ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  minHeight: "400px",
                }}
              >
                <Spin size="large" />
              </div>
            ) : orders.length === 0 ? (
              <Empty
                description={searchText ? "未找到匹配的订单" : "暂无订单"}
                style={{ marginTop: "100px" }}
              />
            ) : (
              <>
                <div style={{ background: "#f5f5f5" }}>
                  {orders.map((item: Order) => {
                    const statusInfo = getStatusInfo(item.status);
                    return (
                      <div
                        key={item.id}
                        style={{
                          padding: 0,
                          marginBottom: "8px",
                          background: "#fff",
                          borderBottom: "1px solid #f0f0f0",
                        }}
                      >
                        <div style={{ width: "100%", padding: "12px" }}>
                          {/* 店铺名称和状态 */}
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: "12px",
                              paddingBottom: "8px",
                              borderBottom: "1px solid #f0f0f0",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                              }}
                            >
                              <div
                                style={{
                                  width: "20px",
                                  height: "20px",
                                  borderRadius: "50%",
                                  background: "#f0f0f0",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: "10px",
                                }}
                              >
                                🏪
                              </div>
                              <Text strong style={{ fontSize: "14px" }}>
                                商家店铺
                              </Text>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                gap: "6px",
                                alignItems: "center",
                              }}
                            >
                              <Tag
                                color={statusInfo.color}
                                style={{ margin: 0 }}
                              >
                                {statusInfo.text}
                              </Tag>
                              {item.isAbnormal && (
                                <Tag color="error" style={{ margin: 0 }}>
                                  异常
                                </Tag>
                              )}
                            </div>
                          </div>

                          {/* 订单信息 */}
                          <div
                            style={{
                              display: "flex",
                              gap: "12px",
                              marginBottom: "12px",
                            }}
                          >
                            {/* 商品图片占位 */}
                            <div
                              style={{
                                width: "80px",
                                height: "80px",
                                background: "#f0f0f0",
                                flexShrink: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "24px",
                              }}
                            >
                              📦
                            </div>

                            {/* 商品信息 */}
                            <div
                              style={{
                                flex: 1,
                                display: "flex",
                                flexDirection: "column",
                                gap: "4px",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                }}
                              >
                                <Text
                                  strong
                                  style={{
                                    fontSize: "14px",
                                    lineHeight: "20px",
                                  }}
                                  ellipsis={{ tooltip: true }}
                                >
                                  订单号: {formatOrderNo(item.id)}
                                </Text>
                                {item.isAbnormal && (
                                  <Tag
                                    color="error"
                                    style={{ fontSize: "12px" }}
                                  >
                                    异常订单
                                  </Tag>
                                )}
                              </div>
                              {item.isAbnormal && item.abnormalReason && (
                                <Text
                                  style={{
                                    fontSize: "12px",
                                    color: "#ff4d4f",
                                    lineHeight: "18px",
                                  }}
                                  ellipsis={{ tooltip: true }}
                                >
                                  ⚠️ {item.abnormalReason}
                                </Text>
                              )}
                              <Text
                                style={{
                                  fontSize: "12px",
                                  color: "#999",
                                  lineHeight: "18px",
                                }}
                                ellipsis={{ tooltip: true }}
                              >
                                收货人: {item.recipientName}
                              </Text>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  fontSize: "12px",
                                  color: "#999",
                                }}
                              >
                                <EnvironmentOutlined
                                  style={{ fontSize: "10px" }}
                                />
                                <Text
                                  ellipsis={{ tooltip: true }}
                                  style={{ fontSize: "12px", color: "#999" }}
                                >
                                  {item.recipientAddress}
                                </Text>
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  marginTop: "4px",
                                }}
                              >
                                <Text
                                  strong
                                  style={{ fontSize: "16px", color: "#ff2442" }}
                                >
                                  ¥{item.amount.toFixed(2)}
                                </Text>
                                <Text
                                  style={{ fontSize: "12px", color: "#999" }}
                                >
                                  {formatDate(item.createTime)}
                                </Text>
                              </div>
                            </div>
                          </div>

                          {/* 操作按钮 - 只显示查看物流 */}
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "flex-end",
                              gap: "8px",
                            }}
                          >
                            <Button
                              type="primary"
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/tracking/${item.id}`);
                              }}
                            >
                              查看物流
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* 触底加载指示器和观察目标 */}
                <div
                  ref={observerTargetRef}
                  style={{ padding: "16px", textAlign: "center" }}
                >
                  {loadingMore && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                      }}
                    >
                      <Spin size="small" />
                      <Text style={{ color: "#999" }}>加载更多...</Text>
                    </div>
                  )}
                  {!pagination.hasMore && orders.length > 0 && (
                    <Text style={{ color: "#999" }}>没有更多订单了</Text>
                  )}
                </div>
              </>
            )}
          </Spin>
        </PullToRefresh>
      </Content>

      {/* 筛选抽屉 */}
      <Drawer
        title="筛选"
        placement="bottom"
        size={300}
        open={filterVisible}
        onClose={() => setFilterVisible(false)}
        footer={
          <div style={{ display: "flex", gap: "12px", padding: "12px" }}>
            <Button
              block
              onClick={() => {
                setFilterOptions({});
                setFilterVisible(false);
              }}
            >
              重置
            </Button>
            <Button
              type="primary"
              block
              onClick={() => handleApplyFilter(filterOptions)}
            >
              确定
            </Button>
          </div>
        }
      >
        <Space direction="vertical" style={{ width: "100%" }} size="large">
          <div>
            <Text strong style={{ marginBottom: "12px", display: "block" }}>
              排序方式
            </Text>
            <Radio.Group
              value={filterOptions.sortBy || "createTime"}
              onChange={(e) =>
                setFilterOptions({ ...filterOptions, sortBy: e.target.value })
              }
            >
              <Space direction="vertical">
                <Radio value="createTime">按时间排序</Radio>
                <Radio value="amount">按金额排序</Radio>
              </Space>
            </Radio.Group>
          </div>
          <div>
            <Text strong style={{ marginBottom: "12px", display: "block" }}>
              排序方向
            </Text>
            <Radio.Group
              value={filterOptions.sortDirection || "DESC"}
              onChange={(e) =>
                setFilterOptions({
                  ...filterOptions,
                  sortDirection: e.target.value,
                })
              }
            >
              <Space direction="vertical">
                <Radio value="DESC">降序（最新/最高）</Radio>
                <Radio value="ASC">升序（最早/最低）</Radio>
              </Space>
            </Radio.Group>
          </div>
        </Space>
      </Drawer>

      {/* 新建订单弹窗 */}
      <CreateOrderModal
        open={createOrderVisible}
        onCancel={() => setCreateOrderVisible(false)}
        onSuccess={handleCreateOrderSuccess}
      />
    </Layout>
  );
};

export default OrderList;
