/**
 * 使用示例文件
 * 这个文件展示了如何在不同场景下使用 @repo/http-client
 */

import { HttpClient, createHttpClient } from "@repo/http-client";

// ==================== 示例 1: 基础使用 ====================

const basicClient = new HttpClient({
  baseURL: "http://localhost:3000",
  timeout: 30000,
});

// GET 请求
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function example1() {
  const response = await basicClient.get("/api/users");
  console.log(response.data);
}

// POST 请求
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function example2() {
  const response = await basicClient.post("/api/users", {
    name: "John",
    email: "john@example.com",
  });
  console.log(response.data);
}

// ==================== 示例 2: 带认证的使用 ====================

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const authClient = new HttpClient({
  baseURL: "http://localhost:3000",
  enableAuth: true,
  getToken: () => {
    // 从 localStorage 获取 token
    return localStorage.getItem("token");
  },
  onAuthError: () => {
    // token 失效时跳转到登录页
    localStorage.removeItem("token");
    window.location.href = "/login";
  },
});

// ==================== 示例 3: 自定义拦截器 ====================

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const customClient = new HttpClient({
  baseURL: "http://localhost:3000",
  requestInterceptor: (config) => {
    // 添加请求 ID
    config.headers["X-Request-ID"] = `${Date.now()}-${Math.random()}`;
    console.log("发送请求:", config.url);
    return config;
  },
  responseInterceptor: (response) => {
    console.log("收到响应:", response.status);
    return response;
  },
  errorInterceptor: async (error) => {
    console.error("请求错误:", error.message);
    // 可以在这里实现重试逻辑
    throw error;
  },
});

// ==================== 示例 4: 创建服务层 ====================

// 创建 API 客户端实例
// 注意：在实际项目中，VITE_API_BASE_URL 会通过 Vite 的环境变量系统自动注入
const API_BASE_URL = "http://localhost:3000"; // 或使用环境变量: import.meta.env.VITE_API_BASE_URL

const apiClient = createHttpClient({
  baseURL: API_BASE_URL,
  timeout: 30000,
  enableAuth: true,
  getToken: () => localStorage.getItem("token"),
  onAuthError: () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  },
});

// 用户服务
export const userService = {
  async getUsers(params?: { page?: number; pageSize?: number }) {
    const response = await apiClient.get("/api/users", { params });
    return response.data;
  },

  async getUserById(id: string) {
    const response = await apiClient.get(`/api/users/${id}`);
    return response.data;
  },

  async createUser(userData: { name: string; email: string }) {
    const response = await apiClient.post("/api/users", userData);
    return response.data;
  },

  async updateUser(id: string, userData: { name?: string; email?: string }) {
    const response = await apiClient.put(`/api/users/${id}`, userData);
    return response.data;
  },

  async deleteUser(id: string) {
    const response = await apiClient.delete(`/api/users/${id}`);
    return response.data;
  },
};

// ==================== 示例 5: 错误处理 ====================

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function exampleWithErrorHandling() {
  try {
    const response = await apiClient.get("/api/users");
    console.log("成功:", response.data);
  } catch (error) {
    if (error instanceof Error) {
      console.error("错误:", error.message);
    }
  }

  // 跳过默认错误处理
  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const response = await apiClient.get("/api/users", {
      skipErrorHandler: true,
    });
  } catch (error) {
    // 自行处理错误
    console.error("自定义错误处理:", error);
  }
}
