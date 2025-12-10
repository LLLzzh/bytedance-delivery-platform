import { useEffect, useRef, useState, useCallback } from "react";
import { WebSocketClient, WebSocketCallbacks } from "../services/websocket";
import { OrderStatus, Coordinates } from "../services/order";

/**
 * 订单追踪 Hook
 * 手动管理 WebSocket 连接：
 * - 不自动建立连接，需要手动调用 connect() 方法
 * - 订单状态为 delivered 或 cancelled 时自动断开连接
 * - 页面离开时自动清理连接
 */
export function useOrderTracking(
  orderId: string | undefined,
  orderStatus: OrderStatus | undefined,
  callbacks: {
    onPositionUpdate?: (coordinates: Coordinates) => void;
    onStatusUpdate?: (status: OrderStatus, message?: string) => void;
    onError?: (error: Error) => void;
  }
) {
  const wsClientRef = useRef<WebSocketClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<Error | null>(null);

  // 判断是否可以建立 WebSocket 连接
  const canConnect = useCallback(() => {
    if (!orderId || !orderStatus) {
      return false;
    }
    // 仅在运输中或已到达状态时可以建立连接
    return orderStatus === "shipping" || orderStatus === "arrived";
  }, [orderId, orderStatus]);

  // 建立连接（手动触发）
  const connect = useCallback(() => {
    if (!orderId) {
      callbacks.onError?.(new Error("订单ID不存在"));
      return;
    }

    if (!canConnect()) {
      callbacks.onError?.(new Error("当前订单状态不支持实时追踪"));
      return;
    }

    // 如果已经连接，不重复连接
    if (wsClientRef.current?.isConnected()) {
      return;
    }

    // 如果正在连接中，不重复连接
    if (isConnecting) {
      return;
    }

    setIsConnecting(true);
    setConnectionError(null);

    // 清理旧连接
    if (wsClientRef.current) {
      wsClientRef.current.disconnect();
    }

    const wsCallbacks: WebSocketCallbacks = {
      onConnected: (id) => {
        console.log(`[useOrderTracking] Connected for order ${id}`);
        setIsConnected(true);
        setIsConnecting(false);
        setConnectionError(null);
      },
      onPositionUpdate: (id, coordinates) => {
        if (id === orderId) {
          callbacks.onPositionUpdate?.(coordinates);
        }
      },
      onStatusUpdate: (id, status, message) => {
        if (id === orderId) {
          // 将字符串状态转换为 OrderStatus 类型
          const statusEnum = status as OrderStatus;
          callbacks.onStatusUpdate?.(statusEnum, message);

          // 如果订单已完成或取消，断开连接
          if (statusEnum === "delivered" || statusEnum === "cancelled") {
            disconnect();
          }
        }
      },
      onError: (error) => {
        console.error(`[useOrderTracking] WebSocket error:`, error);
        setConnectionError(error);
        setIsConnected(false);
        setIsConnecting(false);
        callbacks.onError?.(error);
      },
      onClose: () => {
        setIsConnected(false);
        setIsConnecting(false);
      },
    };

    const client = new WebSocketClient(orderId, wsCallbacks);
    wsClientRef.current = client;
    client.connect();
  }, [orderId, canConnect, isConnecting, callbacks]);

  // 断开连接
  const disconnect = useCallback(() => {
    if (wsClientRef.current) {
      wsClientRef.current.disconnect();
      wsClientRef.current = null;
      setIsConnected(false);
      setIsConnecting(false);
    }
  }, []);

  // 当订单状态变为已完成或已取消时，自动断开连接
  useEffect(() => {
    if (orderStatus === "delivered" || orderStatus === "cancelled") {
      disconnect();
    }
  }, [orderStatus, disconnect]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    isConnecting,
    connectionError,
    canConnect: canConnect(),
    connect,
    disconnect,
  };
}
