import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Layout,
  Typography,
  Button,
  Empty,
  Spin,
  message,
  Tag,
  Avatar,
} from "antd";
import {
  LeftOutlined,
  ReloadOutlined,
  RadarChartOutlined,
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

/**
 * 计算两点之间的距离（米）- 使用 Haversine 公式
 */
function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
  const R = 6371000; // 地球半径（米）
  const lat1 = (coord1[1] * Math.PI) / 180;
  const lat2 = (coord2[1] * Math.PI) / 180;
  const deltaLat = ((coord2[1] - coord1[1]) * Math.PI) / 180;
  const deltaLon = ((coord2[0] - coord1[0]) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

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

  // 如果订单异常，添加异常记录（将在最后移到最上方）
  let abnormalItem: TimelineItem | null = null;
  if (order.isAbnormal && order.lastUpdateTime) {
    abnormalItem = {
      time: formatDateTime(order.lastUpdateTime).time,
      date: formatDateTime(order.lastUpdateTime).date,
      status: "异常",
      detail: order.abnormalReason || "长时间未更新",
      timestamp: order.lastUpdateTime,
    };
    timeline.push(abnormalItem);
  }

  // 按时间倒序排列（最新的在上面）
  const reversedTimeline = timeline.reverse();

  // 如果有异常记录，将异常移到最上方（无论时间如何）
  if (abnormalItem) {
    // 找到异常项在数组中的位置
    const abnormalIndex = reversedTimeline.findIndex(
      (item) =>
        item.status === "异常" && item.timestamp === abnormalItem?.timestamp
    );
    if (abnormalIndex !== -1) {
      // 移除异常项
      const [abnormal] = reversedTimeline.splice(abnormalIndex, 1);
      // 将异常项插入到最前面
      reversedTimeline.unshift(abnormal);
    }
  }

  return reversedTimeline;
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
  const autoConnectAttemptedRef = useRef(false);
  const prevOrderStatusRef = useRef<OrderStatus | undefined>(undefined);

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
  const { isConnected, connect } = useOrderTracking(
    orderId,
    order?.status,
    {
      onPositionUpdate: handlePositionUpdate,
      onStatusUpdate: handleStatusUpdate,
      onError: (error) => {
        console.error("[TrackingDetail] WebSocket error:", error);
        const errorMessage = error.message || "实时追踪连接失败";
        if (
          errorMessage.includes("不支持实时追踪") ||
          errorMessage.includes("异常订单")
        ) {
          message.warning(errorMessage);
        } else {
          message.error(errorMessage || "实时追踪连接失败，请稍后重试");
        }
      },
    },
    order?.isAbnormal
  );

  // 自动连接逻辑：判断货物是否离目的地距离小于10km
  // 仅在 Shipping 状态时自动连接，Arrived 状态不应该再连接（因为货物已经到达）
  // 异常订单不进行实时跟踪
  useEffect(() => {
    if (!order || isConnected) {
      // 如果订单不存在或已经连接，不执行自动连接
      return;
    }

    // 如果订单有异常，不进行实时跟踪
    if (order.isAbnormal) {
      console.log("[TrackingDetail] 订单存在异常，不进行实时跟踪");
      return;
    }

    const currentStatus = order.status;
    const prevStatus = prevOrderStatusRef.current;

    // 更新状态记录
    prevOrderStatusRef.current = currentStatus;

    // 只允许在运输中状态时自动连接
    if (currentStatus !== OrderStatus.Shipping) {
      // 如果从 Shipping 状态变为非 Shipping，重置自动连接标记
      if (prevStatus === OrderStatus.Shipping) {
        autoConnectAttemptedRef.current = false;
      }
      return;
    }

    // 如果从非 Shipping 状态变为 Shipping，重置自动连接标记
    if (prevStatus !== OrderStatus.Shipping) {
      autoConnectAttemptedRef.current = false;
    }

    // 如果已经尝试过自动连接，不再尝试
    if (autoConnectAttemptedRef.current) {
      return;
    }

    // 检查是否有当前位置和目的地坐标
    const currentPos = pathData?.currentPosition || order.currentPosition;
    const destinationPos = order.recipientCoords;

    if (!currentPos || !destinationPos) {
      console.log(
        "[TrackingDetail] 缺少位置信息，无法自动连接:",
        "currentPos:",
        currentPos,
        "destinationPos:",
        destinationPos
      );
      return;
    }

    // 计算距离（米）
    const distanceInMeters = calculateDistance(currentPos, destinationPos);
    const distanceInKm = distanceInMeters / 1000;

    console.log(
      `[TrackingDetail] 当前距离目的地: ${distanceInKm.toFixed(2)}km`
    );

    // 如果距离小于10km，自动建立WebSocket连接
    if (distanceInKm < 10) {
      console.log(
        `[TrackingDetail] 距离目的地 ${distanceInKm.toFixed(2)}km，自动建立实时追踪连接`
      );
      autoConnectAttemptedRef.current = true; // 标记已尝试自动连接
      connect();
      message.info("货物即将到达，已自动开启实时追踪");
    }
  }, [order, pathData, isConnected, connect]);

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

  const timeline = order ? generateTimeline(order) : [];
  const mapPath = pathData?.routePath || order?.routePath || [];
  const currentPos = pathData?.currentPosition || order?.currentPosition;

  // 获取面板高度
  const getPanelHeight = (): string => {
    const windowHeight = window.innerHeight;
    const headerHeight = 50;
    const availableHeight = windowHeight - headerHeight;

    // 如果订单状态为待发货，面板占满屏幕（减去header高度）
    if (order?.status === OrderStatus.Pending) {
      return `${availableHeight}px`;
    }

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
    // 如果订单状态为待发货，不显示地图
    if (order?.status === OrderStatus.Pending) {
      return "0px";
    }

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
          minHeight: order?.status === OrderStatus.Pending ? "0px" : "200px",
          position: "relative",
          width: "100%",
          background: "#f5f5f5",
          overflow: "hidden",
          flexShrink: 0,
          display: order?.status === OrderStatus.Pending ? "none" : "block",
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
            height: "12px",
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
            <div
              style={{
                boxShadow: "none",
                background: "#fff",
                borderRadius: "8px",
                padding: "8px",
                margin: "4px",
              }}
            >
              {/* 订单基本信息 */}
              <div
                style={{
                  marginBottom: "8px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "12px" }}
                >
                  <Avatar
                    src="https://gw.alipayobjects.com/zos/rmsportal/KDpgvguMpGfqaHPjicRK.svg"
                    style={{
                      backgroundColor: "#fff",
                      width: "20px",
                      height: "20px",
                    }}
                  />
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <Text style={{ fontSize: "14px", color: "#7e7e7e" }}>
                      莱鸟速递
                    </Text>
                    <Text
                      style={{
                        fontSize: "14px",
                        color: "#7e7e7e",
                        marginLeft: "8px",
                        maxWidth: "200px",
                        display: "inline-block",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {order.id}
                    </Text>
                  </div>
                </div>
                <Button
                  type="text"
                  size="small"
                  style={{ color: "#999", fontSize: "12px" }}
                  onClick={() => {
                    navigator.clipboard.writeText(order.id);
                    message.success("复制成功");
                  }}
                >
                  复制
                </Button>
              </div>

              {/* 时间线 */}
              <div style={{ padding: "16px 0 0 0" }}>
                {timeline.map((item, index) => {
                  const isLatest = index === 0;
                  return (
                    <div
                      key={index}
                      style={{
                        display: "flex",
                        position: "relative",
                        paddingBottom:
                          index < timeline.length - 1 ? "4px" : "8px",
                      }}
                    >
                      {/* 左侧时间线 */}
                      <div
                        style={{
                          position: "relative",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          marginRight: "8px",
                          width: "28px",
                          flexShrink: 0,
                        }}
                      >
                        {/* 连接线 */}
                        {index < timeline.length && (
                          <div
                            style={{
                              position: "absolute",
                              top: "0",
                              bottom: "-4px",
                              left: "50%",
                              width: "1px",
                              transform: "translateX(-50%)",
                              backgroundColor: "#e8e8e8",
                              zIndex: 0,
                            }}
                          />
                        )}
                        {/* 圆点 */}
                        <div
                          style={{
                            width: isLatest ? "28px" : "10px",
                            height: isLatest ? "28px" : "10px",
                            marginTop: isLatest ? "0px" : "4px",
                            borderRadius: "50%",
                            backgroundColor:
                              item.status === "异常"
                                ? "#ff4d4f"
                                : isLatest
                                  ? "#1677FF"
                                  : "#d9d9d9",
                            border: isLatest
                              ? "3px solid #fff"
                              : "2px solid #fff",
                            boxShadow:
                              item.status === "异常"
                                ? "0 0 0 2px rgba(255, 77, 79, 0.2)"
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
                            <svg
                              viewBox="0 0 1024 1024"
                              version="1.1"
                              xmlns="http://www.w3.org/2000/svg"
                              width="14"
                              height="14"
                              fill="#ffffff"
                            >
                              <path d="M912 190h-69.9c-9.8 0-19.1 4.5-25.1 12.2L404.7 724.5 207 474a32 32 0 0 0-25.1-12.2H112c-6.7 0-10.4 7.7-6.3 12.9l273.9 347c12.8 16.2 37.4 16.2 50.3 0l488.4-618.9c4.1-5.1 0.4-12.8-6.3-12.8z" />
                            </svg>
                          )}
                        </div>
                      </div>

                      {/* 右侧内容 */}
                      <div
                        style={{
                          flex: 1,
                          paddingTop: "0px",
                          paddingBottom: "4px",
                        }}
                      >
                        {/* 第一部分：如果是最新节点，显示大标题；如果是历史节点，先显示时间 */}
                        {isLatest ? (
                          // === 最新节点样式 (Latest) ===
                          // 结构：标题 -> 时间 -> 详情
                          <div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center", // 让文字和标签垂直居中
                                gap: "4px",
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: "18px", // 保持大标题样式
                                  color: "#1677FF", // 保持蓝色高亮
                                  fontWeight: 600,
                                  lineHeight: "26px",
                                }}
                              >
                                {item.status}
                              </Text>

                              {/* 恢复原本的异常 Tag 判断逻辑 */}
                              {item.status === "异常" && (
                                <Tag
                                  color="error"
                                  style={{
                                    margin: 0,
                                    fontSize: "12px", // 微调一下大小使其更协调
                                  }}
                                >
                                  异常
                                </Tag>
                              )}

                              {/* 确认收货按钮 */}
                              {item.status === "已到达" && (
                                <Button
                                  type="primary"
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleConfirmDelivery();
                                  }}
                                  style={{
                                    marginLeft: "auto",
                                    fontSize: "12px",
                                    height: "24px",
                                    padding: "0 8px",
                                    borderRadius: "12px",
                                  }}
                                >
                                  确认收货
                                </Button>
                              )}
                            </div>

                            <Text
                              style={{
                                fontSize: "12px",
                                color: "#333", // 深色一点的时间
                                marginBottom: "2px",
                                display: "block",
                                fontWeight: 500,
                              }}
                            >
                              {item.date} {item.time}
                            </Text>

                            <Text
                              style={{
                                fontSize: "14px",
                                color: "#333",
                                display: "block",
                              }}
                            >
                              {item.detail}
                            </Text>
                          </div>
                        ) : (
                          // === 历史节点样式 (History) ===
                          // 结构：时间 -> 标题/状态 -> 详情
                          <div>
                            {/* 1. 时间行 (灰色小字) */}
                            <Text
                              style={{
                                fontSize: "12px",
                                color: "#999",
                                marginBottom: "4px",
                                display: "block",
                              }}
                            >
                              {item.date} {item.time}
                            </Text>

                            {/* 2. 详情内容 (核心变化：这里通常把【状态】和【详情】合并显示，或者上下排列) */}
                            <div style={{ marginBottom: "4px" }}>
                              <Text
                                style={{
                                  fontSize: "15px",
                                  color: "#999", // 历史记录整体偏灰
                                  fontWeight: 400,
                                  lineHeight: "22px",
                                }}
                              >
                                {item.status && (
                                  <span
                                    style={{
                                      fontWeight: 500,
                                      color: "#666",
                                      marginRight: "2px",
                                      fontSize: "15px",
                                    }}
                                  >
                                    {item.status}
                                  </span>
                                )}
                                <span
                                  style={{ color: "#999", fontSize: "14px" }}
                                >
                                  丨{item.detail}
                                </span>
                              </Text>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Content>
      </div>
    </Layout>
  );
};

export default TrackingDetail;
