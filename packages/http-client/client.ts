import axios, {
  AxiosInstance,
  AxiosResponse,
  AxiosError,
  InternalAxiosRequestConfig,
} from "axios";
import { HttpClientConfig, ApiResponse, RequestConfig } from "./types";

/**
 * HTTP 客户端类
 * 提供统一的请求接口，包含拦截器、错误处理等功能
 */
export class HttpClient {
  private instance: AxiosInstance;
  private config: Required<Pick<HttpClientConfig, "baseURL" | "timeout">> &
    Pick<HttpClientConfig, "getToken" | "onAuthError" | "enableAuth">;

  constructor(config: HttpClientConfig = {}) {
    // 合并配置
    this.config = {
      baseURL: config.baseURL || "http://localhost:3000",
      timeout: config.timeout || 30000,
      enableAuth: config.enableAuth ?? true,
      getToken: config.getToken,
      onAuthError: config.onAuthError,
    };

    // 创建 axios 实例
    this.instance = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // 设置请求拦截器
    this.setupRequestInterceptor(config.requestInterceptor);

    // 设置响应拦截器
    this.setupResponseInterceptor(config.responseInterceptor);

    // 设置错误拦截器
    this.setupErrorInterceptor(config.errorInterceptor);
  }

  /**
   * 设置请求拦截器
   */
  private setupRequestInterceptor(
    customInterceptor?: HttpClientConfig["requestInterceptor"]
  ): void {
    this.instance.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        // 添加认证 token
        if (this.config.enableAuth && this.config.getToken) {
          const token = this.config.getToken();
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }

        // 执行自定义请求拦截器
        if (customInterceptor) {
          return await customInterceptor(config);
        }

        return config;
      },
      (error: AxiosError) => {
        return Promise.reject(error);
      }
    );
  }

  /**
   * 设置响应拦截器
   */
  private setupResponseInterceptor(
    customInterceptor?: HttpClientConfig["responseInterceptor"]
  ): void {
    this.instance.interceptors.response.use(
      async (response: AxiosResponse) => {
        // 执行自定义响应拦截器
        if (customInterceptor) {
          return await customInterceptor(response);
        }

        // 默认处理：如果响应数据有 code 字段，检查是否为成功
        const data = response.data;
        if (data && typeof data === "object" && "code" in data) {
          // 可以根据业务逻辑调整成功判断条件
          if (data.code !== 0 && data.code !== 200) {
            return Promise.reject(new Error(data.message || "请求失败"));
          }
        }

        return response;
      },
      (error: AxiosError) => {
        return Promise.reject(error);
      }
    );
  }

  /**
   * 设置错误拦截器
   */
  private setupErrorInterceptor(
    customInterceptor?: HttpClientConfig["errorInterceptor"]
  ): void {
    this.instance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError<unknown>) => {
        // 如果请求配置中设置了 skipErrorHandler，直接抛出错误
        const config = error.config as RequestConfig | undefined;
        if (config?.skipErrorHandler) {
          return Promise.reject(error);
        }

        // 执行自定义错误拦截器
        if (customInterceptor) {
          try {
            return await customInterceptor(error);
          } catch (err) {
            return Promise.reject(err);
          }
        }

        // 默认错误处理
        if (error.response) {
          const status = error.response.status;

          // 401 未授权
          if (status === 401) {
            if (this.config.onAuthError) {
              this.config.onAuthError();
            }
            return Promise.reject(new Error("未授权，请重新登录"));
          }

          // 403 禁止访问
          if (status === 403) {
            return Promise.reject(new Error("没有权限访问该资源"));
          }

          // 404 未找到
          if (status === 404) {
            return Promise.reject(new Error("请求的资源不存在"));
          }

          // 500 服务器错误
          if (status >= 500) {
            return Promise.reject(new Error("服务器错误，请稍后重试"));
          }

          // 其他错误
          const errorData = error.response.data as
            | { message?: string }
            | undefined;
          const message = errorData?.message || error.message || "请求失败";
          return Promise.reject(new Error(message));
        }

        // 网络错误
        if (error.request) {
          return Promise.reject(new Error("网络错误，请检查网络连接"));
        }

        // 其他错误
        return Promise.reject(error);
      }
    );
  }

  /**
   * GET 请求
   */
  async get<T = unknown>(
    url: string,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    const response = await this.instance.get<ApiResponse<T>>(url, config);
    return this.extractData(response);
  }

  /**
   * POST 请求
   */
  async post<T = unknown>(
    url: string,
    data?: unknown,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    const response = await this.instance.post<ApiResponse<T>>(
      url,
      data,
      config
    );
    return this.extractData(response);
  }

  /**
   * PUT 请求
   */
  async put<T = unknown>(
    url: string,
    data?: unknown,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    const response = await this.instance.put<ApiResponse<T>>(url, data, config);
    return this.extractData(response);
  }

  /**
   * PATCH 请求
   */
  async patch<T = unknown>(
    url: string,
    data?: unknown,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    const response = await this.instance.patch<ApiResponse<T>>(
      url,
      data,
      config
    );
    return this.extractData(response);
  }

  /**
   * DELETE 请求
   */
  async delete<T = unknown>(
    url: string,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    const response = await this.instance.delete<ApiResponse<T>>(url, config);
    return this.extractData(response);
  }

  /**
   * 原始请求方法（返回完整的 axios 响应）
   */
  async request<T = unknown>(config: RequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.request<T>(config);
  }

  /**
   * 从响应中提取数据
   */
  private extractData<T>(
    response: AxiosResponse<ApiResponse<T>>
  ): ApiResponse<T> {
    const config = response.config as RequestConfig | undefined;

    // 如果设置了跳过响应拦截器，返回原始响应数据
    if (config?.skipResponseInterceptor) {
      return response.data;
    }

    // 如果响应数据本身就是 ApiResponse 格式，直接返回
    if (
      response.data &&
      typeof response.data === "object" &&
      "data" in response.data
    ) {
      return response.data;
    }

    // 否则包装成 ApiResponse 格式
    return {
      code: 0,
      success: true,
      data: response.data as T,
      message: "success",
    };
  }

  /**
   * 获取底层 axios 实例（用于高级用法）
   */
  getInstance(): AxiosInstance {
    return this.instance;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<HttpClientConfig>): void {
    if (config.baseURL) {
      this.config.baseURL = config.baseURL;
      this.instance.defaults.baseURL = config.baseURL;
    }
    if (config.timeout !== undefined) {
      this.config.timeout = config.timeout;
      this.instance.defaults.timeout = config.timeout;
    }
    if (config.getToken !== undefined) {
      this.config.getToken = config.getToken;
    }
    if (config.onAuthError !== undefined) {
      this.config.onAuthError = config.onAuthError;
    }
    if (config.enableAuth !== undefined) {
      this.config.enableAuth = config.enableAuth;
    }
  }
}

export type { HttpClientConfig };
