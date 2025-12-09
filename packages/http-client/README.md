# @repo/http-client

一个基于 axios 的通用 HTTP 请求库，提供统一的请求接口、拦截器、错误处理等功能。

## 特性

- ✅ 基于 axios，兼容性好
- ✅ TypeScript 完整支持
- ✅ 请求/响应拦截器
- ✅ 自动错误处理
- ✅ 认证 token 自动管理
- ✅ 可配置的基础 URL 和超时时间
- ✅ 灵活的配置选项

## 安装

```bash
pnpm add @repo/http-client
```

## 基本使用

### 创建客户端实例

```typescript
import { HttpClient } from "@repo/http-client";

// 创建客户端实例
const httpClient = new HttpClient({
  baseURL: "http://localhost:3000",
  timeout: 30000,
});

// 使用客户端发送请求
const response = await httpClient.get("/api/users");
console.log(response.data);
```

### 使用便捷函数

```typescript
import { createHttpClient, getHttpClient } from "@repo/http-client";

// 创建并获取默认客户端
const client = createHttpClient({
  baseURL: "http://localhost:3000",
});

// 或获取已创建的默认客户端
const defaultClient = getHttpClient();
```

## 请求方法

### GET 请求

```typescript
// 简单 GET 请求
const response = await httpClient.get("/api/users");

// 带参数的 GET 请求
const response = await httpClient.get("/api/users", {
  params: { page: 1, pageSize: 10 },
});

// 带自定义配置的 GET 请求
const response = await httpClient.get("/api/users", {
  headers: { "X-Custom-Header": "value" },
});
```

### POST 请求

```typescript
// POST 请求
const response = await httpClient.post("/api/users", {
  name: "John",
  email: "john@example.com",
});

// 带自定义配置的 POST 请求
const response = await httpClient.post(
  "/api/users",
  { name: "John" },
  { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
);
```

### PUT 请求

```typescript
const response = await httpClient.put("/api/users/1", {
  name: "John Updated",
});
```

### PATCH 请求

```typescript
const response = await httpClient.patch("/api/users/1", {
  name: "John Patched",
});
```

### DELETE 请求

```typescript
const response = await httpClient.delete("/api/users/1");
```

## 认证配置

### 自动添加 Token

```typescript
import { HttpClient } from "@repo/http-client";

const httpClient = new HttpClient({
  baseURL: "http://localhost:3000",
  enableAuth: true, // 启用自动认证
  getToken: () => {
    // 从 localStorage 或其他地方获取 token
    return localStorage.getItem("token");
  },
  onAuthError: () => {
    // token 失效时的处理，比如跳转到登录页
    window.location.href = "/login";
  },
});
```

### 禁用自动认证

```typescript
const httpClient = new HttpClient({
  baseURL: "http://localhost:3000",
  enableAuth: false, // 禁用自动认证
});
```

## 自定义拦截器

### 请求拦截器

```typescript
const httpClient = new HttpClient({
  baseURL: "http://localhost:3000",
  requestInterceptor: (config) => {
    // 在请求发送前修改配置
    config.headers["X-Request-ID"] = generateRequestId();
    return config;
  },
});
```

### 响应拦截器

```typescript
const httpClient = new HttpClient({
  baseURL: "http://localhost:3000",
  responseInterceptor: (response) => {
    // 在响应返回后处理数据
    if (response.data.code === 0) {
      return response;
    }
    throw new Error(response.data.message);
  },
});
```

### 错误拦截器

```typescript
const httpClient = new HttpClient({
  baseURL: "http://localhost:3000",
  errorInterceptor: async (error) => {
    // 自定义错误处理
    if (error.response?.status === 401) {
      // 处理 401 错误
      await refreshToken();
      // 重试请求
      return httpClient.request(error.config);
    }
    throw error;
  },
});
```

## 错误处理

默认情况下，客户端会自动处理常见的 HTTP 错误：

- **401**: 未授权，会调用 `onAuthError` 回调
- **403**: 禁止访问
- **404**: 资源不存在
- **500+**: 服务器错误

### 跳过错误处理

如果需要自定义错误处理，可以在请求配置中设置 `skipErrorHandler`：

```typescript
try {
  const response = await httpClient.get("/api/users", {
    skipErrorHandler: true,
  });
} catch (error) {
  // 自行处理错误
  console.error("Request failed:", error);
}
```

## 响应数据结构

客户端返回的响应遵循以下格式：

```typescript
interface ApiResponse<T> {
  code?: number; // 响应码，0 或 200 表示成功
  message?: string; // 响应消息
  data?: T; // 响应数据
  success?: boolean; // 是否成功
}
```

如果后端返回的数据不符合此格式，客户端会自动包装：

```typescript
// 后端返回: { name: 'John', age: 30 }
// 客户端返回: { code: 0, success: true, data: { name: 'John', age: 30 } }
```

## 完整示例

```typescript
import { HttpClient } from "@repo/http-client";

// 创建客户端
const apiClient = new HttpClient({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000",
  timeout: 30000,
  enableAuth: true,
  getToken: () => localStorage.getItem("token"),
  onAuthError: () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  },
});

// 使用客户端
export const userService = {
  // 获取用户列表
  async getUsers(params?: { page?: number; pageSize?: number }) {
    const response = await apiClient.get("/api/users", { params });
    return response.data;
  },

  // 获取用户详情
  async getUserById(id: string) {
    const response = await apiClient.get(`/api/users/${id}`);
    return response.data;
  },

  // 创建用户
  async createUser(userData: { name: string; email: string }) {
    const response = await apiClient.post("/api/users", userData);
    return response.data;
  },

  // 更新用户
  async updateUser(id: string, userData: { name?: string; email?: string }) {
    const response = await apiClient.put(`/api/users/${id}`, userData);
    return response.data;
  },

  // 删除用户
  async deleteUser(id: string) {
    const response = await apiClient.delete(`/api/users/${id}`);
    return response.data;
  },
};
```

## API 参考

### HttpClient 类

#### 构造函数

```typescript
new HttpClient(config?: HttpClientConfig)
```

#### 方法

- `get<T>(url: string, config?: RequestConfig): Promise<ApiResponse<T>>`
- `post<T>(url: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>>`
- `put<T>(url: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>>`
- `patch<T>(url: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>>`
- `delete<T>(url: string, config?: RequestConfig): Promise<ApiResponse<T>>`
- `request<T>(config: RequestConfig): Promise<AxiosResponse<T>>`
- `getInstance(): AxiosInstance`
- `updateConfig(config: Partial<HttpClientConfig>): void`

### 便捷函数

- `createHttpClient(config?: HttpClientConfig): HttpClient`
- `getHttpClient(): HttpClient`
- `setHttpClient(client: HttpClient): void`

## 注意事项

1. 默认 baseURL 为 `http://localhost:3000`，生产环境请通过配置覆盖
2. Token 管理需要自行实现存储逻辑（如 localStorage、sessionStorage 等）
3. 错误处理可以根据实际业务需求自定义拦截器
4. 响应数据格式会根据后端实际返回格式自动适配
