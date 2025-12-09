/**
 * WebSocket 服务
 * 负责管理与 Worker 服务的 WebSocket 连接
 */

export type Coordinates = [number, number];

/**
 * WebSocket 消息类型
 */
export interface WebSocketMessage {
  type: "connected" | "position_update" | "status_update" | "error";
  orderId?: string;
  coordinates?: Coordinates;
  sequence?: number; // 序列号，用于确保轨迹点按顺序处理
  status?: string;
  message?: string;
  timestamp?: string;
}

/**
 * WebSocket 事件回调
 */
export interface WebSocketCallbacks {
  onConnected?: (orderId: string) => void;
  onPositionUpdate?: (orderId: string, coordinates: Coordinates) => void;
  onStatusUpdate?: (orderId: string, status: string, message?: string) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
}

/**
 * 待处理的位置更新消息
 */
interface PendingPositionUpdate {
  sequence: number;
  coordinates: Coordinates;
  timestamp: string;
}

/**
 * WebSocket 客户端类
 */
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private orderId: string;
  private url: string;
  private callbacks: WebSocketCallbacks;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000; // 3秒
  private reconnectTimer: number | null = null;
  private pingInterval: number | null = null;
  private readonly pingIntervalMs = 30000; // 30秒发送一次ping

  // 消息队列，确保轨迹点按顺序处理
  private pendingMessages: Map<number, PendingPositionUpdate> = new Map();
  private expectedSequence = 1; // 期望的下一个序列号

  constructor(
    orderId: string,
    callbacks: WebSocketCallbacks,
    workerUrl?: string
  ) {
    this.orderId = orderId;
    // 从环境变量获取 Worker URL，默认 localhost:3006
    const baseUrl =
      workerUrl || import.meta.env.VITE_WORKER_WS_URL || "ws://localhost:3006";
    this.url = `${baseUrl}/ws/${orderId}`;
    this.callbacks = callbacks;
  }

  /**
   * 连接 WebSocket
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log(`[WebSocket] Already connected for order ${this.orderId}`);
      return;
    }

    try {
      console.log(`[WebSocket] Connecting to ${this.url}`);
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log(`[WebSocket] Connected for order ${this.orderId}`);
        this.reconnectAttempts = 0;
        // 重置消息队列
        this.pendingMessages.clear();
        this.expectedSequence = 1;
        this.callbacks.onConnected?.(this.orderId);
        this.startPing();
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error(
            `[WebSocket] Failed to parse message:`,
            error,
            event.data
          );
        }
      };

      this.ws.onerror = (error) => {
        console.error(`[WebSocket] Error for order ${this.orderId}:`, error);
        this.callbacks.onError?.(new Error("WebSocket connection error"));
      };

      this.ws.onclose = () => {
        console.log(`[WebSocket] Closed for order ${this.orderId}`);
        this.stopPing();
        this.callbacks.onClose?.();

        // 如果不是主动关闭，尝试重连
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        } else {
          console.error(
            `[WebSocket] Max reconnect attempts reached for order ${this.orderId}`
          );
        }
      };
    } catch (error) {
      console.error(`[WebSocket] Failed to create connection:`, error);
      this.callbacks.onError?.(error as Error);
    }
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopPing();
    // 清理消息队列
    this.pendingMessages.clear();
    this.expectedSequence = 1;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * 处理位置更新消息，确保按顺序处理
   */
  private handlePositionUpdate(message: WebSocketMessage): void {
    if (!message.orderId || !message.coordinates) {
      return;
    }

    const sequence = message.sequence || 0;

    // 如果没有序列号，直接处理（向后兼容）
    if (sequence === 0) {
      this.callbacks.onPositionUpdate?.(message.orderId, message.coordinates);
      return;
    }

    // 如果收到的是期望的序列号，直接处理
    if (sequence === this.expectedSequence) {
      this.callbacks.onPositionUpdate?.(message.orderId, message.coordinates);
      this.expectedSequence++;

      // 处理队列中等待的消息
      this.processPendingMessages();
    } else if (sequence > this.expectedSequence) {
      // 如果序列号大于期望值，说明有消息丢失或乱序，先缓存
      this.pendingMessages.set(sequence, {
        sequence,
        coordinates: message.coordinates,
        timestamp: message.timestamp || new Date().toISOString(),
      });

      // 如果队列太大，说明可能有问题，重置期望序列号
      if (this.pendingMessages.size > 100) {
        console.warn(
          `[WebSocket] Too many pending messages, resetting sequence. Expected: ${this.expectedSequence}, Got: ${sequence}`
        );
        // 处理所有缓存的消息（按序列号排序）
        const sortedMessages = Array.from(this.pendingMessages.entries()).sort(
          (a, b) => a[0] - b[0]
        );

        for (const [seq, msg] of sortedMessages) {
          if (seq >= this.expectedSequence) {
            this.callbacks.onPositionUpdate?.(message.orderId, msg.coordinates);
            this.expectedSequence = seq + 1;
            this.pendingMessages.delete(seq);
          }
        }
      }
    } else {
      // 如果序列号小于期望值，说明是重复消息，忽略
      console.warn(
        `[WebSocket] Received duplicate or out-of-order message. Expected: ${this.expectedSequence}, Got: ${sequence}`
      );
    }
  }

  /**
   * 处理队列中等待的消息
   */
  private processPendingMessages(): void {
    while (this.pendingMessages.has(this.expectedSequence)) {
      const message = this.pendingMessages.get(this.expectedSequence);
      if (message) {
        this.callbacks.onPositionUpdate?.(this.orderId, message.coordinates);
        this.pendingMessages.delete(this.expectedSequence);
        this.expectedSequence++;
      }
    }
  }

  /**
   * 处理收到的消息
   */
  private handleMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case "connected":
        console.log(
          `[WebSocket] Connection confirmed for order ${message.orderId}`
        );
        break;

      case "position_update":
        if (message.orderId && message.coordinates) {
          this.handlePositionUpdate(message);
        }
        break;

      case "status_update":
        if (message.orderId && message.status) {
          this.callbacks.onStatusUpdate?.(
            message.orderId,
            message.status,
            message.message
          );
        }
        break;

      case "error":
        console.error(`[WebSocket] Server error:`, message.message);
        this.callbacks.onError?.(
          new Error(message.message || "Unknown WebSocket error")
        );
        break;

      default:
        console.warn(`[WebSocket] Unknown message type:`, message.type);
    }
  }

  /**
   * 安排重连
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    console.log(
      `[WebSocket] Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  /**
   * 开始发送 ping（保持连接活跃）
   */
  private startPing(): void {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        // 发送 ping 消息（如果服务器支持）
        this.ws.send(JSON.stringify({ type: "ping" }));
      }
    }, this.pingIntervalMs);
  }

  /**
   * 停止发送 ping
   */
  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * 获取连接状态
   */
  getState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  /**
   * 是否已连接
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
