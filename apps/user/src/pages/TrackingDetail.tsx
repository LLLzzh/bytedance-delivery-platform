import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Layout,
  Typography,
  Button,
  Empty,
  Card,
  Spin,
  message,
  Tag,
} from "antd";
import {
  LeftOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  RadarChartOutlined,
  DisconnectOutlined,
} from "@ant-design/icons";
import { DeliveryMap } from "@repo/ui";
import {
  orderService,
  Order,
  OrderStatus,
  Coordinates,
} from "../services/order";
import { useOrderTracking } from "../hooks/useOrderTracking";

const { Header, Content } = Layout;
const { Title, Text } = Typography;

type PanelPosition = "middle" | "top" | "bottom";

/**
 * 时间线项
 */
interface TimelineItem {
  time: string;
  date: string;
  status: string;
  detail: string;
  timestamp?: string;
}

/**
 * 生成时间线数据（按时间顺序，最新的在上面）
 */
function generateTimeline(order: Order): TimelineItem[] {
  const timeline: TimelineItem[] = [];
  const now = new Date();

  // 格式化时间戳为 "MM-DD HH:mm" 格式
  const formatDateTime = (
    timestamp?: string
  ): { date: string; time: string; fullTime: string } => {
    const date = timestamp ? new Date(timestamp) : now;
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return {
      date: `${month}-${day}`,
      time: `${hours}:${minutes}`,
      fullTime: `${month}-${day} ${hours}:${minutes}`,
    };
  };

  // 根据订单状态生成时间线（按时间顺序，从旧到新）
  // 1. 已下单（最早）
  timeline.push({
    time: formatDateTime(order.createTime).time,
    date: formatDateTime(order.createTime).date,
    status: "已下单",
    detail: "商家已接单，准备发货",
    timestamp: order.createTime,
  });

  // 2. 已发货
  if (
    order.status === OrderStatus.PickedUp ||
    order.status === OrderStatus.Shipping ||
    order.status === OrderStatus.Arrived ||
    order.status === OrderStatus.Delivered
  ) {
    timeline.push({
      time: formatDateTime(order.createTime).time,
      date: formatDateTime(order.createTime).date,
      status: "已发货",
      detail: "包裹已从商家发出",
      timestamp: order.createTime,
    });
  }

  // 3. 运输中
  if (
    order.status === OrderStatus.Shipping ||
    order.status === OrderStatus.Arrived ||
    order.status === OrderStatus.Delivered
  ) {
    timeline.push({
      time: formatDateTime(order.lastUpdateTime).time,
      date: formatDateTime(order.lastUpdateTime).date,
      status: "运输中",
      detail: "快件正在运输途中",
      timestamp: order.lastUpdateTime,
    });
  }

  // 4. 已到达
  if (
    order.status === OrderStatus.Arrived ||
    order.status === OrderStatus.Delivered
  ) {
    timeline.push({
      time: formatDateTime(order.lastUpdateTime).time,
      date: formatDateTime(order.lastUpdateTime).date,
      status: "已到达",
      detail: "包裹已到达目的地，请准备收货",
      timestamp: order.lastUpdateTime,
    });
  }

  // 5. 已签收（最新）
  if (order.status === OrderStatus.Delivered) {
    timeline.push({
      time: formatDateTime(order.lastUpdateTime).time,
      date: formatDateTime(order.lastUpdateTime).date,
      status: "已签收",
      detail: "您的快件已由本人签收，感谢使用",
      timestamp: order.lastUpdateTime,
    });
  }

  // 按时间倒序排列（最新的在上面）
  return timeline.reverse();
}

/**
 * 获取状态显示文本和颜色
 */
function getStatusInfo(status: OrderStatus) {
  switch (status) {
    case OrderStatus.Pending:
      return { text: "待处理", color: "default" };
    case OrderStatus.PickedUp:
      return { text: "已取件", color: "processing" };
    case OrderStatus.Shipping:
      return { text: "运输中", color: "processing" };
    case OrderStatus.Arrived:
      return { text: "已到达", color: "warning" };
    case OrderStatus.Delivered:
      return { text: "已签收", color: "success" };
    case OrderStatus.Cancelled:
      return { text: "已取消", color: "error" };
    default:
      return { text: status, color: "default" };
  }
}

const TrackingDetail: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pathData, setPathData] = useState<{
    routePath: Coordinates[];
    traveledPath: Coordinates[];
    currentPosition?: Coordinates;
  } | null>(null);

  // 面板位置状态
  const [panelPosition, setPanelPosition] = useState<PanelPosition>("middle");
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartHeight, setDragStartHeight] = useState(0);
  const [currentPanelHeight, setCurrentPanelHeight] = useState<number | null>(
    null
  );
  const hasDraggedRef = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);

  // 加载订单详情
  const loadOrderDetail = useCallback(
    async (isRefresh = false) => {
      if (!orderId) return;

      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        // 并行请求订单详情和路径数据
        const [detailResult, pathResult] = await Promise.all([
          orderService.getOrderDetail(orderId),
          orderService.getOrderPath(orderId).catch((err) => {
            console.warn("Failed to load path data:", err);
            return null;
          }),
        ]);

        if (detailResult.success && detailResult.order) {
          setOrder(detailResult.order);

          // 更新路径数据
          if (pathResult?.success && pathResult.data) {
            setPathData({
              routePath: pathResult.data.routePath || [],
              traveledPath: pathResult.data.traveledPath || [],
              currentPosition: pathResult.data.currentPosition,
            });
          } else {
            // 如果没有路径数据，使用订单中的路径信息
            setPathData({
              routePath: detailResult.order.routePath || [],
              traveledPath: detailResult.order.traveledPath || [],
              currentPosition: detailResult.order.currentPosition,
            });
          }
        } else {
          message.error("获取订单详情失败");
        }
      } catch (error) {
        console.error("Failed to load order detail:", error);
        message.error("获取订单详情失败，请稍后重试");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [orderId]
  );

  // 初始加载
  useEffect(() => {
    loadOrderDetail();
  }, [loadOrderDetail]);

  // WebSocket 位置更新回调
  // 使用平滑动画更新小车位置
  const handlePositionUpdate = useCallback((coordinates: Coordinates) => {
    console.log("[TrackingDetail] Position updated:", coordinates);
    setPathData((prev) => {
      if (!prev) {
        // 如果没有路径数据，初始化
        return {
          routePath: [],
          traveledPath: [coordinates],
          currentPosition: coordinates,
        };
      }

      // 将新位置添加到已走过的路径（确保不重复）
      const lastPosition = prev.traveledPath?.[prev.traveledPath.length - 1];
      const isNewPosition =
        !lastPosition ||
        lastPosition[0] !== coordinates[0] ||
        lastPosition[1] !== coordinates[1];

      return {
        ...prev,
        // 更新当前位置（DeliveryMap 组件会自动使用平滑动画）
        currentPosition: coordinates,
        // 只有新位置才添加到路径
        traveledPath: isNewPosition
          ? [...(prev.traveledPath || []), coordinates]
          : prev.traveledPath || [],
      };
    });
  }, []);

  // WebSocket 状态更新回调
  const handleStatusUpdate = useCallback(
    (status: OrderStatus, statusMessage?: string) => {
      console.log("[TrackingDetail] Status updated:", status, statusMessage);
      if (order) {
        setOrder({ ...order, status });
        message.info(
          statusMessage || `订单状态已更新: ${getStatusInfo(status).text}`
        );
      }
    },
    [order]
  );

  // 使用 WebSocket 追踪（手动连接）
  const {
    isConnected,
    isConnecting,
    canConnect,
    connect: connectWebSocket,
    disconnect: disconnectWebSocket,
  } = useOrderTracking(orderId, order?.status, {
    onPositionUpdate: handlePositionUpdate,
    onStatusUpdate: handleStatusUpdate,
    onError: (error) => {
      console.error("[TrackingDetail] WebSocket error:", error);
      const errorMessage = error.message || "实时追踪连接失败";
      if (errorMessage.includes("不支持实时追踪")) {
        message.warning(errorMessage);
      } else {
        message.error(errorMessage || "实时追踪连接失败，请稍后重试");
      }
    },
  });

  // 处理连接/断开操作
  const handleToggleRealtimeTracking = () => {
    if (isConnected) {
      disconnectWebSocket();
      message.info("已断开实时追踪");
    } else {
      connectWebSocket();
    }
  };

  // 确认收货
  const handleConfirmDelivery = async () => {
    if (!orderId) return;

    try {
      const result = await orderService.confirmDelivery(orderId);
      if (result.success) {
        message.success("确认收货成功");
        // 刷新订单详情
        loadOrderDetail(true);
      } else {
        message.error("确认收货失败");
      }
    } catch (error) {
      console.error("Failed to confirm delivery:", error);
      message.error("确认收货失败，请稍后重试");
    }
  };

  const statusInfo = order ? getStatusInfo(order.status) : null;
  const timeline = order ? generateTimeline(order) : [];
  const mapPath = pathData?.routePath || order?.routePath || [];
  const currentPos = pathData?.currentPosition || order?.currentPosition;

  // 获取面板高度
  const getPanelHeight = (): string => {
    const windowHeight = window.innerHeight;
    const headerHeight = 50;
    const availableHeight = windowHeight - headerHeight;

    switch (panelPosition) {
      case "top":
        return `${availableHeight * 0.9}px`;
      case "middle":
        return `${availableHeight * 0.5}px`;
      case "bottom":
        return `${availableHeight * 0.15}px`;
      default:
        return `${availableHeight * 0.5}px`;
    }
  };

  // 获取地图高度（根据面板高度动态计算）
  const getMapHeight = (): string => {
    const windowHeight = window.innerHeight;
    const headerHeight = 50;
    const availableHeight = windowHeight - headerHeight;

    // 获取当前面板的实际高度
    let panelHeight: number;
    if (currentPanelHeight !== null) {
      // 使用存储的实际高度（拖拽中或刚结束）
      panelHeight = currentPanelHeight;
    } else if (panelRef.current) {
      // 从 DOM 获取
      panelHeight = panelRef.current.offsetHeight;
    } else {
      // 根据位置计算
      switch (panelPosition) {
        case "top":
          panelHeight = availableHeight * 0.9;
          break;
        case "middle":
          panelHeight = availableHeight * 0.5;
          break;
        case "bottom":
          panelHeight = availableHeight * 0.15;
          break;
        default:
          panelHeight = availableHeight * 0.5;
      }
    }

    // 地图高度 = 可用高度 - 面板高度
    const mapHeight = availableHeight - panelHeight;
    return `${Math.max(200, mapHeight)}px`; // 最小高度200px
  };

  // 拖拽开始
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    hasDraggedRef.current = false;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    setDragStartY(clientY);
    if (panelRef.current) {
      setDragStartHeight(panelRef.current.offsetHeight);
    }
  };

  // 拖拽中
  const handleDragMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!panelRef.current) return;

      // 对于触摸事件，确保可以 preventDefault
      if ("touches" in e) {
        e.preventDefault();
      }

      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const currentDragStartY = dragStartY;
      const currentDragStartHeight = dragStartHeight;
      const deltaY = currentDragStartY - clientY; // 向上拖拽为正

      // 如果移动距离超过阈值，认为是拖拽而不是点击
      if (Math.abs(deltaY) > 5) {
        hasDraggedRef.current = true;
      }

      const newHeight = currentDragStartHeight + deltaY;

      const windowHeight = window.innerHeight;
      const headerHeight = 50;
      const availableHeight = windowHeight - headerHeight;
      const minHeight = availableHeight * 0.1;
      const maxHeight = availableHeight * 0.95;

      const clampedHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
      panelRef.current.style.height = `${clampedHeight}px`;
      // 实时更新面板高度，以便地图高度同步更新
      setCurrentPanelHeight(clampedHeight);

      // 同时更新地图容器高度
      if (mapContainerRef.current) {
        const windowHeight = window.innerHeight;
        const headerHeight = 50;
        const availableHeight = windowHeight - headerHeight;
        const mapHeight = availableHeight - clampedHeight;
        mapContainerRef.current.style.height = `${Math.max(200, mapHeight)}px`;
      }
    },
    [dragStartY, dragStartHeight]
  );

  // 拖拽结束
  const handleDragEnd = useCallback(() => {
    if (!panelRef.current) return;

    setIsDragging(false);

    // 只有在实际拖拽了的情况下才更新位置
    if (hasDraggedRef.current) {
      const finalHeight = panelRef.current.offsetHeight;
      const windowHeight = window.innerHeight;
      const headerHeight = 50;
      const availableHeight = windowHeight - headerHeight;

      const topThreshold = availableHeight * 0.7;
      const bottomThreshold = availableHeight * 0.3;

      let newPosition: PanelPosition;
      if (finalHeight >= topThreshold) {
        newPosition = "top";
      } else if (finalHeight <= bottomThreshold) {
        newPosition = "bottom";
      } else {
        newPosition = "middle";
      }

      setPanelPosition(newPosition);
      // 更新面板高度状态
      setCurrentPanelHeight(finalHeight);
    } else {
      // 如果没有拖拽，清除高度状态，使用计算值
      setCurrentPanelHeight(null);
    }

    hasDraggedRef.current = false;
  }, []);

  // 监听拖拽事件
  useEffect(() => {
    if (!isDragging) {
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      handleDragMove(e);
    };
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      handleDragMove(e);
    };
    const handleMouseUp = (e: MouseEvent) => {
      e.preventDefault();
      handleDragEnd();
    };
    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      handleDragEnd();
    };

    document.addEventListener("mousemove", handleMouseMove, { passive: false });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("mouseup", handleMouseUp, { passive: false });
    document.addEventListener("touchend", handleTouchEnd, { passive: false });

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // 点击切换位置
  const handleTogglePosition = () => {
    if (panelPosition === "middle") {
      setPanelPosition("top");
    } else if (panelPosition === "top") {
      setPanelPosition("bottom");
    } else {
      setPanelPosition("middle");
    }
    // 清除高度状态，使用计算值
    setCurrentPanelHeight(null);
  };

  // 当面板位置改变时，清除高度状态
  useEffect(() => {
    if (isDragging) {
      return;
    }

    // 延迟清除，等待动画完成
    const timer = setTimeout(() => {
      setCurrentPanelHeight(null);
    }, 300);
    return () => clearTimeout(timer);
  }, [panelPosition, isDragging]);

  // 使用原生事件监听器来处理 touchstart，避免 passive 事件问题
  useEffect(() => {
    const handle = dragHandleRef.current;
    if (!handle) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.cancelable) {
        e.preventDefault();
        e.stopPropagation();
      }
      setIsDragging(true);
      hasDraggedRef.current = false;
      const clientY = e.touches[0].clientY;
      setDragStartY(clientY);
      if (panelRef.current) {
        setDragStartHeight(panelRef.current.offsetHeight);
      }
    };

    handle.addEventListener("touchstart", handleTouchStart, {
      passive: false,
      capture: true,
    });

    return () => {
      handle.removeEventListener("touchstart", handleTouchStart, {
        capture: true,
      } as EventListenerOptions);
    };
  }, []);

  return (
    <Layout
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#fff",
        overflow: "hidden",
        minHeight: "100vh",
        position: "relative",
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
        <Button
          type="text"
          icon={<ReloadOutlined />}
          loading={refreshing}
          onClick={() => loadOrderDetail(true)}
          style={{ marginLeft: "auto" }}
        />
      </Header>

      {/* Map Section (Dynamic Height) */}
      <div
        ref={mapContainerRef}
        style={{
          height: getMapHeight(),
          minHeight: "200px",
          position: "relative",
          width: "100%",
          background: "#f5f5f5",
          overflow: "hidden",
          flexShrink: 0,
          transition: isDragging
            ? "none"
            : "height 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)",
        }}
      >
        {loading && !order ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
              width: "100%",
              background: "#f5f5f5",
              position: "absolute",
              top: 0,
              left: 0,
              zIndex: 1,
            }}
          >
            <Spin size="large" />
          </div>
        ) : order &&
          mapPath.length > 0 &&
          mapPath.every(
            (coord) => Array.isArray(coord) && coord.length === 2
          ) ? (
          <div
            style={{
              height: "100%",
              width: "100%",
              position: "relative",
              background: "#f5f5f5",
            }}
          >
            <DeliveryMap
              pathCoordinates={mapPath}
              currentPosition={
                currentPos &&
                Array.isArray(currentPos) &&
                currentPos.length === 2
                  ? currentPos
                  : mapPath[0]
              }
              traveledPath={pathData?.traveledPath}
              riderIconUrl="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 80'%3E%3Cdefs%3E%3ClinearGradient id='bodyGrad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%234A90E2;stop-opacity:1' /%3E%3Cstop offset='50%25' style='stop-color:%233579BD;stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:%232E5A8A;stop-opacity:1' /%3E%3C/linearGradient%3E%3ClinearGradient id='topGrad' x1='0%25' y1='0%25' x2='0%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%235BA3E8;stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:%234A90E2;stop-opacity:1' /%3E%3C/linearGradient%3E%3Cfilter id='shadow3d'%3E%3CfeDropShadow dx='3' dy='4' stdDeviation='4' flood-color='%23000' flood-opacity='0.4'/%3E%3C/filter%3E%3C/defs%3E%3Cg filter='url(%23shadow3d)'%3E%3Cpath d='M15 50 L20 50 L22 48 L30 48 L32 50 L70 50 L72 48 L80 48 L82 50 L90 50 L92 52 L92 60 L90 62 L82 62 L80 64 L72 64 L70 62 L32 62 L30 64 L22 64 L20 62 L15 62 Z' fill='url(%23bodyGrad)'/%3E%3Crect x='20' y='35' width='15' height='13' fill='url(%23topGrad)' rx='1'/%3E%3Crect x='50' y='35' width='35' height='13' fill='url(%23topGrad)' rx='1'/%3E%3Crect x='22' y='37' width='11' height='9' fill='%23FFFFFF' opacity='0.6' rx='0.5'/%3E%3Crect x='52' y='37' width='31' height='9' fill='%23FFFFFF' opacity='0.6' rx='0.5'/%3E%3Ccircle cx='28' cy='62' r='7' fill='%231A1A1A'/%3E%3Ccircle cx='28' cy='62' r='4.5' fill='%23FFFFFF'/%3E%3Ccircle cx='28' cy='62' r='2' fill='%23333'/%3E%3Ccircle cx='78' cy='62' r='7' fill='%231A1A1A'/%3E%3Ccircle cx='78' cy='62' r='4.5' fill='%23FFFFFF'/%3E%3Ccircle cx='78' cy='62' r='2' fill='%23333'/%3E%3Cpath d='M15 50 L15 62' stroke='%23244A6E' stroke-width='1.5'/%3E%3Cpath d='M90 50 L90 62' stroke='%23244A6E' stroke-width='1.5'/%3E%3C/g%3E%3C/svg%3E"
              enableAnimatedPath={true}
            />
          </div>
        ) : order &&
          currentPos &&
          Array.isArray(currentPos) &&
          currentPos.length === 2 ? (
          <div
            style={{
              height: "100%",
              width: "100%",
              position: "relative",
              background: "#f5f5f5",
            }}
          >
            <DeliveryMap
              pathCoordinates={[currentPos]}
              currentPosition={currentPos}
              traveledPath={pathData?.traveledPath}
              riderIconUrl="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 80'%3E%3Cdefs%3E%3ClinearGradient id='bodyGrad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%234A90E2;stop-opacity:1' /%3E%3Cstop offset='50%25' style='stop-color:%233579BD;stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:%232E5A8A;stop-opacity:1' /%3E%3C/linearGradient%3E%3ClinearGradient id='topGrad' x1='0%25' y1='0%25' x2='0%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%235BA3E8;stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:%234A90E2;stop-opacity:1' /%3E%3C/linearGradient%3E%3Cfilter id='shadow3d'%3E%3CfeDropShadow dx='3' dy='4' stdDeviation='4' flood-color='%23000' flood-opacity='0.4'/%3E%3C/filter%3E%3C/defs%3E%3Cg filter='url(%23shadow3d)'%3E%3Cpath d='M15 50 L20 50 L22 48 L30 48 L32 50 L70 50 L72 48 L80 48 L82 50 L90 50 L92 52 L92 60 L90 62 L82 62 L80 64 L72 64 L70 62 L32 62 L30 64 L22 64 L20 62 L15 62 Z' fill='url(%23bodyGrad)'/%3E%3Crect x='20' y='35' width='15' height='13' fill='url(%23topGrad)' rx='1'/%3E%3Crect x='50' y='35' width='35' height='13' fill='url(%23topGrad)' rx='1'/%3E%3Crect x='22' y='37' width='11' height='9' fill='%23FFFFFF' opacity='0.6' rx='0.5'/%3E%3Crect x='52' y='37' width='31' height='9' fill='%23FFFFFF' opacity='0.6' rx='0.5'/%3E%3Ccircle cx='28' cy='62' r='7' fill='%231A1A1A'/%3E%3Ccircle cx='28' cy='62' r='4.5' fill='%23FFFFFF'/%3E%3Ccircle cx='28' cy='62' r='2' fill='%23333'/%3E%3Ccircle cx='78' cy='62' r='7' fill='%231A1A1A'/%3E%3Ccircle cx='78' cy='62' r='4.5' fill='%23FFFFFF'/%3E%3Ccircle cx='78' cy='62' r='2' fill='%23333'/%3E%3Cpath d='M15 50 L15 62' stroke='%23244A6E' stroke-width='1.5'/%3E%3Cpath d='M90 50 L90 62' stroke='%23244A6E' stroke-width='1.5'/%3E%3C/g%3E%3C/svg%3E"
              enableAnimatedPath={false}
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
              background: "#f5f5f5",
              position: "absolute",
              top: 0,
              left: 0,
              zIndex: 1,
            }}
          >
            <Empty description="暂无路径信息" />
          </div>
        )}
        {/* WebSocket 连接状态指示 */}
        {isConnected && order && (
          <div
            style={{
              position: "absolute",
              top: "10px",
              right: "10px",
              background: "rgba(82, 196, 26, 0.9)",
              color: "#fff",
              padding: "4px 8px",
              borderRadius: "4px",
              fontSize: "12px",
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <RadarChartOutlined />
            <span>实时追踪中</span>
          </div>
        )}
      </div>

      {/* Timeline Section (Bottom Scrollable Panel) */}
      <div
        ref={panelRef}
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: getPanelHeight(),
          background: "#fff",
          borderTopLeftRadius: "16px",
          borderTopRightRadius: "16px",
          boxShadow: "0 -2px 10px rgba(0,0,0,0.1)",
          zIndex: 10,
          transition: isDragging
            ? "none"
            : "height 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* 拖拽手柄 */}
        <div
          ref={dragHandleRef}
          style={{
            height: "32px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            cursor: isDragging ? "grabbing" : "grab",
            userSelect: "none",
            touchAction: "none",
            flexShrink: 0,
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            handleDragStart(e);
          }}
          onClick={(e) => {
            // 如果只是点击（没有拖拽），切换位置
            if (!hasDraggedRef.current) {
              e.stopPropagation();
              handleTogglePosition();
            }
          }}
        >
          <div
            style={{
              width: "40px",
              height: "4px",
              backgroundColor: "#ddd",
              borderRadius: "2px",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#bbb";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#ddd";
            }}
          />
        </div>

        {/* 内容区域 */}
        <Content
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px",
            background: "#f5f5f5",
          }}
        >
          {loading && !order ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                minHeight: "200px",
              }}
            >
              <Spin size="large" />
            </div>
          ) : !order ? (
            <Empty description="未找到订单信息" />
          ) : (
            <Card
              variant="outlined"
              style={{
                boxShadow: "none",
                background: "#fff",
                borderRadius: "8px",
              }}
            >
              {/* 订单基本信息 */}
              <div
                style={{
                  marginBottom: "24px",
                  paddingBottom: "20px",
                  borderBottom: "1px solid #f0f0f0",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "12px",
                  }}
                >
                  <Text strong style={{ fontSize: "16px", color: "#333" }}>
                    订单号: {order.id.slice(-8)}
                  </Text>
                  {statusInfo && (
                    <Tag
                      color={statusInfo.color}
                      style={{
                        fontSize: "13px",
                        padding: "2px 8px",
                        borderRadius: "2px",
                      }}
                    >
                      {statusInfo.text}
                    </Tag>
                  )}
                </div>
                <div
                  style={{
                    fontSize: "14px",
                    color: "#666",
                    marginBottom: "8px",
                    lineHeight: "22px",
                  }}
                >
                  <Text>收货人: {order.recipientName}</Text>
                </div>
                <div
                  style={{
                    fontSize: "14px",
                    color: "#666",
                    marginBottom: "12px",
                    lineHeight: "22px",
                  }}
                >
                  <Text>收货地址: {order.recipientAddress}</Text>
                </div>
                <div
                  style={{
                    fontSize: "18px",
                    color: "#ff4d4f",
                    fontWeight: 600,
                  }}
                >
                  <Text>订单金额: ¥{order.amount.toFixed(2)}</Text>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    marginTop: "12px",
                    flexWrap: "wrap",
                  }}
                >
                  {/* 根据订单状态显示不同的操作按钮 */}
                  {order.status === OrderStatus.Shipping &&
                    // 运输中：只能查看实时路径
                    canConnect && (
                      <Button
                        type={isConnected ? "default" : "primary"}
                        icon={
                          isConnected ? (
                            <DisconnectOutlined />
                          ) : (
                            <RadarChartOutlined />
                          )
                        }
                        loading={isConnecting}
                        onClick={handleToggleRealtimeTracking}
                      >
                        {isConnected ? "断开实时追踪" : "查看实时路径"}
                      </Button>
                    )}
                  {order.status === OrderStatus.Arrived && (
                    // 待收货：可以查看实时路径 + 确认收货
                    <>
                      {canConnect && (
                        <Button
                          type={isConnected ? "default" : "primary"}
                          icon={
                            isConnected ? (
                              <DisconnectOutlined />
                            ) : (
                              <RadarChartOutlined />
                            )
                          }
                          loading={isConnecting}
                          onClick={handleToggleRealtimeTracking}
                        >
                          {isConnected ? "断开实时追踪" : "查看实时路径"}
                        </Button>
                      )}
                      <Button
                        type="primary"
                        icon={<CheckCircleOutlined />}
                        onClick={handleConfirmDelivery}
                      >
                        确认收货
                      </Button>
                    </>
                  )}
                  {(order.status === OrderStatus.Pending ||
                    order.status === OrderStatus.PickedUp ||
                    order.status === OrderStatus.Delivered ||
                    order.status === OrderStatus.Cancelled) && (
                    // 其他状态：不显示操作按钮，或显示只读信息
                    <Text type="secondary" style={{ fontSize: "12px" }}>
                      {order.status === OrderStatus.Delivered && "订单已完成"}
                      {order.status === OrderStatus.Cancelled && "订单已取消"}
                      {order.status === OrderStatus.Pending && "订单待处理"}
                      {order.status === OrderStatus.PickedUp && "订单已取件"}
                    </Text>
                  )}
                </div>
              </div>

              {/* 淘宝风格的时间线 */}
              <div style={{ padding: "16px 0 0 0" }}>
                <div
                  style={{
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "#333",
                    marginBottom: "20px",
                    paddingBottom: "12px",
                    borderBottom: "1px solid #f0f0f0",
                  }}
                >
                  物流跟踪
                </div>
                {timeline.map((item, index) => {
                  const isLatest = index === 0;
                  return (
                    <div
                      key={index}
                      style={{
                        display: "flex",
                        position: "relative",
                        paddingBottom:
                          index < timeline.length - 1 ? "28px" : "8px",
                      }}
                    >
                      {/* 左侧时间线 */}
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          marginRight: "16px",
                          flexShrink: 0,
                        }}
                      >
                        {/* 圆点 */}
                        <div
                          style={{
                            width: isLatest ? "18px" : "12px",
                            height: isLatest ? "18px" : "12px",
                            borderRadius: "50%",
                            backgroundColor: isLatest ? "#52c41a" : "#d9d9d9",
                            border: isLatest
                              ? "3px solid #fff"
                              : "2px solid #fff",
                            boxShadow: isLatest
                              ? "0 0 0 2px rgba(82, 196, 26, 0.2)"
                              : "none",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            zIndex: 2,
                            position: "relative",
                            transition: "all 0.3s ease",
                          }}
                        >
                          {isLatest && (
                            <div
                              style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "50%",
                                backgroundColor: "#fff",
                              }}
                            />
                          )}
                        </div>
                        {/* 连接线 */}
                        {index < timeline.length - 1 && (
                          <div
                            style={{
                              width: "2px",
                              flex: 1,
                              backgroundColor: isLatest ? "#52c41a" : "#e8e8e8",
                              marginTop: "6px",
                              minHeight: "32px",
                            }}
                          />
                        )}
                      </div>

                      {/* 右侧内容 */}
                      <div
                        style={{
                          flex: 1,
                          paddingTop: isLatest ? "0" : "2px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            marginBottom: "8px",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: isLatest ? "16px" : "15px",
                              color: isLatest ? "#333" : "#666",
                              fontWeight: isLatest ? 600 : 400,
                              lineHeight: "22px",
                            }}
                          >
                            {item.status}
                          </Text>
                          <Text
                            style={{
                              fontSize: "13px",
                              color: "#999",
                              marginLeft: "12px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {item.date} {item.time}
                          </Text>
                        </div>
                        <Text
                          style={{
                            fontSize: "14px",
                            color: "#999",
                            lineHeight: "20px",
                            display: "block",
                          }}
                        >
                          {item.detail}
                        </Text>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </Content>
      </div>
    </Layout>
  );
};

export default TrackingDetail;
