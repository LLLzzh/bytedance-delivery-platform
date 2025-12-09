/**
 * 统一的 API 客户端配置
 * 可以在各个前端应用中导入并自定义使用
 */

import { HttpClient } from "./client";
import type { HttpClientConfig } from "./types";

/**
 * 创建默认的 API 客户端
 * 可以在各个前端应用中调用此函数创建客户端实例
 */
export function createApiClient(
  config?: Partial<HttpClientConfig>
): HttpClient {
  // 获取环境变量（兼容 Vite 和其他环境）
  const getEnvVar = (key: string, defaultValue: string): string => {
    if (typeof window === "undefined") return defaultValue;
    try {
      const env = import.meta.env as { [key: string]: string | undefined };
      return env[key] || defaultValue;
    } catch {
      return defaultValue;
    }
  };

  const defaultConfig: HttpClientConfig = {
    baseURL: getEnvVar("VITE_API_BASE_URL", "http://localhost:3000"),
    timeout: 30000,
    enableAuth: true,
    getToken: () => {
      if (typeof window === "undefined") return null;
      return localStorage.getItem("token");
    },
    onAuthError: () => {
      if (typeof window === "undefined") return;
      localStorage.removeItem("token");
      // 可以根据实际需求跳转到登录页
      // window.location.href = '/login';
    },
    ...config,
  };

  return new HttpClient(defaultConfig);
}

/**
 * 预设的客户端配置
 * 可以根据不同环境或应用需求使用不同的配置
 */
export const clientConfigs = {
  // 开发环境配置
  development: {
    baseURL: "http://localhost:3000",
    timeout: 30000,
  },
  // 生产环境配置
  production: {
    baseURL: (() => {
      try {
        const env = import.meta.env as { VITE_API_BASE_URL?: string };
        return env.VITE_API_BASE_URL || "https://api.example.com";
      } catch {
        return "https://api.example.com";
      }
    })(),
    timeout: 30000,
  },
  // 无认证的配置（用于公开 API）
  public: {
    baseURL: (() => {
      try {
        const env = import.meta.env as { VITE_API_BASE_URL?: string };
        return env.VITE_API_BASE_URL || "http://localhost:3000";
      } catch {
        return "http://localhost:3000";
      }
    })(),
    timeout: 30000,
    enableAuth: false,
  },
};
