import { FastifyInstance } from "fastify";
import { Coordinates } from "../shared/geo.types.js";

/**
 * WebSocket 连接信息
 */
interface WebSocketConnection {
  orderId: string;
  socket: WebSocket; // WebSocket 实例
  connectedAt: Date;
}

/**
 * WebSocket 管理器
 * 负责管理客户端连接和位置推送
 */
export class WebSocketManager {
  private connections: Map<string, Set<WebSocketConnection>> = new Map(); // orderId -> Set of connections
  private fastify: FastifyInstance;

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  /**
   * 注册 WebSocket 路由
   */
  registerRoutes(): void {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const manager = this; // 保存 this 引用，用于在回调中访问
    this.fastify.register(async function (fastify) {
      fastify.get("/ws/:orderId", { websocket: true }, (connection, req) => {
        const params = req.params as { orderId: string };
        const orderId = params.orderId;

        if (!orderId) {
          connection.socket.close(1008, "Order ID is required");
          return;
        }

        // 添加连接
        manager.addConnection(orderId, connection.socket);

        console.log(`[WebSocketManager] Client connected for order ${orderId}`);

        // 发送初始连接确认
        connection.socket.send(
          JSON.stringify({
            type: "connected",
            orderId,
            timestamp: new Date().toISOString(),
          })
        );

        // 处理断开连接
        connection.socket.on("close", () => {
          manager.removeConnection(orderId, connection.socket);
          console.log(
            `[WebSocketManager] Client disconnected for order ${orderId}`
          );
        });

        // 处理错误
        connection.socket.on("error", (error: Error) => {
          console.error(
            `[WebSocketManager] WebSocket error for order ${orderId}:`,
            error
          );
          manager.removeConnection(orderId, connection.socket);
        });

        // 处理 ping/pong（保持连接活跃）
        connection.socket.on("ping", () => {
          connection.socket.pong();
        });
      });
    });
  }

  /**
   * 添加 WebSocket 连接
   */
  private addConnection(orderId: string, socket: WebSocket): void {
    if (!this.connections.has(orderId)) {
      this.connections.set(orderId, new Set());
    }

    const connection: WebSocketConnection = {
      orderId,
      socket,
      connectedAt: new Date(),
    };

    this.connections.get(orderId)!.add(connection);
  }

  /**
   * 移除 WebSocket 连接
   */
  private removeConnection(orderId: string, socket: WebSocket): void {
    const connections = this.connections.get(orderId);
    if (connections) {
      for (const conn of connections) {
        if (conn.socket === socket) {
          connections.delete(conn);
          break;
        }
      }

      // 如果没有连接了，删除该订单的映射
      if (connections.size === 0) {
        this.connections.delete(orderId);
      }
    }
  }

  /**
   * 推送位置更新到所有订阅该订单的客户端
   * @param orderId 订单ID
   * @param position 位置坐标
   * @param sequence 序列号，用于确保轨迹点按顺序处理
   */
  broadcastPositionUpdate(
    orderId: string,
    position: Coordinates,
    sequence?: number
  ): void {
    const connections = this.connections.get(orderId);
    if (!connections || connections.size === 0) {
      return;
    }

    const message = JSON.stringify({
      type: "position_update",
      orderId,
      coordinates: position,
      sequence, // 添加序列号
      timestamp: new Date().toISOString(),
    });

    // 发送给所有连接的客户端
    for (const conn of connections) {
      try {
        if (conn.socket.readyState === 1) {
          // WebSocket.OPEN = 1
          conn.socket.send(message);
        } else {
          // 连接已关闭，移除它
          this.removeConnection(orderId, conn.socket);
        }
      } catch (error) {
        console.error(
          `[WebSocketManager] Error sending message to order ${orderId}:`,
          error
        );
        this.removeConnection(orderId, conn.socket);
      }
    }
  }

  /**
   * 批量推送位置更新
   */
  broadcastPositionUpdates(updates: Map<string, Coordinates>): void {
    for (const [orderId, position] of updates.entries()) {
      this.broadcastPositionUpdate(orderId, position);
    }
  }

  /**
   * 推送状态变更通知
   */
  broadcastStatusUpdate(
    orderId: string,
    status: string,
    message?: string
  ): void {
    const connections = this.connections.get(orderId);
    if (!connections || connections.size === 0) {
      return;
    }

    const statusMessage = JSON.stringify({
      type: "status_update",
      orderId,
      status,
      message,
      timestamp: new Date().toISOString(),
    });

    // 发送给所有连接的客户端
    for (const conn of connections) {
      try {
        if (conn.socket.readyState === 1) {
          // WebSocket.OPEN = 1
          conn.socket.send(statusMessage);
        } else {
          // 连接已关闭，移除它
          this.removeConnection(orderId, conn.socket);
        }
      } catch (error) {
        console.error(
          `[WebSocketManager] Error sending status update to order ${orderId}:`,
          error
        );
        this.removeConnection(orderId, conn.socket);
      }
    }
  }

  /**
   * 获取指定订单的连接数
   */
  getConnectionCount(orderId: string): number {
    return this.connections.get(orderId)?.size || 0;
  }

  /**
   * 获取所有活跃连接数
   */
  getTotalConnectionCount(): number {
    let total = 0;
    for (const connections of this.connections.values()) {
      total += connections.size;
    }
    return total;
  }
}
