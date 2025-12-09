import {
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
  AxiosError,
} from "axios";

/**
 * HTTP 客户端配置选项
 */
export interface HttpClientConfig {
  /** API 基础 URL，默认为 http://localhost:3000 */
  baseURL?: string;
  /** 请求超时时间（毫秒），默认 30000 */
  timeout?: number;
  /** 是否在请求头中自动添加认证 token */
  enableAuth?: boolean;
  /** 获取 token 的函数，用于在请求头中添加认证信息 */
  getToken?: () => string | null;
  /** 当 token 失效或认证失败时的回调函数 */
  onAuthError?: () => void;
  /** 请求拦截器 */
  requestInterceptor?: (
    config: InternalAxiosRequestConfig
  ) => InternalAxiosRequestConfig | Promise<InternalAxiosRequestConfig>;
  /** 响应拦截器 */
  responseInterceptor?: (
    response: AxiosResponse
  ) => AxiosResponse | Promise<AxiosResponse>;
  /** 错误拦截器 */
  errorInterceptor?: (error: AxiosError<unknown>) => Promise<unknown>;
}

/**
 * API 响应数据结构
 */
export interface ApiResponse<T = unknown> {
  /** 响应码，通常 0 表示成功 */
  code?: number;
  /** 响应消息 */
  message?: string;
  /** 响应数据 */
  data?: T;
  /** 是否成功 */
  success?: boolean;
}

/**
 * 分页响应数据结构
 */
export interface PaginatedResponse<T = unknown> {
  /** 数据列表 */
  list: T[];
  /** 总数 */
  total: number;
  /** 当前页 */
  page?: number;
  /** 每页数量 */
  pageSize?: number;
}

/**
 * 请求方法类型
 */
export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

/**
 * 请求配置（扩展 axios 配置）
 */
export interface RequestConfig extends Omit<AxiosRequestConfig, "method"> {
  /** 是否跳过错误处理，默认 false */
  skipErrorHandler?: boolean;
  /** 是否跳过响应拦截器，默认 false */
  skipResponseInterceptor?: boolean;
}
