export { HttpClient } from "./client";
export { createApiClient, clientConfigs } from "./api-client";
export type {
  HttpClientConfig,
  ApiResponse,
  PaginatedResponse,
  HttpMethod,
  RequestConfig,
} from "./types";

/**
 * 创建 HTTP 客户端实例的便捷函数
 */
import { HttpClient, HttpClientConfig } from "./client";

let defaultClient: HttpClient | null = null;

/**
 * 创建并返回默认的 HTTP 客户端实例
 * 如果已存在实例，则返回现有实例；否则创建新实例
 */
export function createHttpClient(config?: HttpClientConfig): HttpClient {
  if (!defaultClient) {
    defaultClient = new HttpClient(config);
  }
  return defaultClient;
}

/**
 * 获取默认的 HTTP 客户端实例
 * 如果实例不存在，会创建一个使用默认配置的实例
 */
export function getHttpClient(): HttpClient {
  if (!defaultClient) {
    defaultClient = new HttpClient();
  }
  return defaultClient;
}

/**
 * 设置默认的 HTTP 客户端实例
 */
export function setHttpClient(client: HttpClient): void {
  defaultClient = client;
}

// 默认导出
export default {
  HttpClient,
  createHttpClient,
  getHttpClient,
  setHttpClient,
};
