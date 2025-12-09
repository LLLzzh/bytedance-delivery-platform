# 迁移指南

本文档帮助你从直接使用 axios 迁移到使用 `@repo/http-client`。

## 为什么迁移？

`@repo/http-client` 提供了：

- 统一的错误处理
- 自动的 token 管理
- 标准化的响应格式
- 更好的 TypeScript 支持

## 迁移步骤

### 1. 安装依赖

```bash
pnpm add @repo/http-client
```

### 2. 创建 HTTP 客户端实例

**之前（直接使用 axios）:**

```typescript
import axios from "axios";

const API_BASE_URL = "http://localhost:3000";

// 需要手动处理每个请求的 token 和错误
const response = await axios.get(`${API_BASE_URL}/api/users`, {
  headers: {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  },
});
```

**之后（使用 @repo/http-client）:**

```typescript
import { createHttpClient } from "@repo/http-client";

const apiClient = createHttpClient({
  baseURL: "http://localhost:3000",
  enableAuth: true,
  getToken: () => localStorage.getItem("token"),
  onAuthError: () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  },
});

const response = await apiClient.get("/api/users");
```

### 3. 迁移服务层代码

**之前:**

```typescript
// src/api/orderService.ts
import axios from "axios";

const API_BASE_URL = "http://localhost:3000";

export const fetchOrders = async (params?: {
  page?: number;
  pageSize?: number;
}) => {
  try {
    const response = await axios.get<{ orders: Order[]; total: number }>(
      `${API_BASE_URL}/api/v1/orders`,
      { params }
    );
    return response.data;
  } catch (error) {
    console.error("获取订单失败:", error);
    throw error;
  }
};
```

**之后:**

```typescript
// src/api/orderService.ts
import { createHttpClient } from "@repo/http-client";

const apiClient = createHttpClient({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000",
  enableAuth: true,
  getToken: () => localStorage.getItem("token"),
});

export const fetchOrders = async (params?: {
  page?: number;
  pageSize?: number;
}) => {
  // 错误处理已由客户端自动处理
  const response = await apiClient.get<{ orders: Order[]; total: number }>(
    "/api/v1/orders",
    { params }
  );
  return response.data;
};
```

### 4. 响应格式变化

**之前:**

```typescript
// axios 直接返回 response.data
const response = await axios.get("/api/users");
const data = response.data; // 直接是后端返回的数据
```

**之后:**

```typescript
// @repo/http-client 返回标准化的 ApiResponse
const response = await apiClient.get("/api/users");
const data = response.data; // 如果是 { code: 0, data: {...} } 格式，会自动提取 data
// 或者
const { data } = response; // 也可以解构
```

### 5. 错误处理变化

**之前:**

```typescript
try {
  const response = await axios.get("/api/users");
} catch (error) {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401) {
      // 手动处理 401
    }
  }
  throw error;
}
```

**之后:**

```typescript
try {
  const response = await apiClient.get("/api/users");
} catch (error) {
  // 401 错误已自动处理（会调用 onAuthError）
  // 其他错误也会自动转换为友好的错误消息
  console.error(error.message);
}
```

## 完整迁移示例

### 用户应用 (apps/user)

**迁移前:**

```typescript
// apps/user/src/api/orderService.ts
import axios from "axios";

const API_BASE_URL = "https://your-api-domain.com";

export const fetchOrders = async (params?: {
  page?: number;
  pageSize?: number;
}) => {
  try {
    const response = await axios.get<{ orders: Order[]; total: number }>(
      `${API_BASE_URL}/api/v1/orders`,
      { params }
    );
    return response.data;
  } catch (error) {
    console.error("获取订单失败:", error);
    throw error;
  }
};
```

**迁移后:**

```typescript
// apps/user/src/api/orderService.ts
import { createHttpClient } from "@repo/http-client";

// 创建客户端实例（可以放在单独的文件中，比如 src/api/client.ts）
const apiClient = createHttpClient({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000",
  timeout: 30000,
  enableAuth: true,
  getToken: () => localStorage.getItem("token"),
  onAuthError: () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  },
});

export const fetchOrders = async (params?: {
  page?: number;
  pageSize?: number;
}) => {
  const response = await apiClient.get<{ orders: Order[]; total: number }>(
    "/api/v1/orders",
    { params }
  );
  return response.data;
};
```

### 商户应用 (apps/merchant)

**迁移前:**

```typescript
// apps/merchant/src/services/fence.ts
export const fenceService = {
  getFences: async (): Promise<FenceData[]> => {
    // 使用模拟数据
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([...]);
      }, 500);
    });
  },
};
```

**迁移后:**

```typescript
// apps/merchant/src/services/fence.ts
import { createHttpClient } from "@repo/http-client";

const apiClient = createHttpClient({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000",
  enableAuth: true,
  getToken: () => localStorage.getItem("token"),
});

export const fenceService = {
  getFences: async (): Promise<FenceData[]> => {
    const response = await apiClient.get<FenceData[]>("/api/fences");
    return response.data || [];
  },

  createFence: async (data: FenceData): Promise<FenceData> => {
    const response = await apiClient.post<FenceData>("/api/fences", data);
    return response.data!;
  },

  updateFence: async (data: FenceData): Promise<FenceData> => {
    const response = await apiClient.put<FenceData>(
      `/api/fences/${data.id}`,
      data
    );
    return response.data!;
  },

  deleteFence: async (id: string | number): Promise<void> => {
    await apiClient.delete(`/api/fences/${id}`);
  },
};
```

## 注意事项

1. **响应格式**: 如果你的后端返回的格式不是 `{ code: 0, data: {...} }`，客户端会自动包装，确保统一返回 `ApiResponse` 格式。

2. **Token 管理**: 确保正确配置 `getToken` 和 `onAuthError`，这样客户端会自动处理认证。

3. **错误处理**: 默认的错误处理会转换常见的 HTTP 错误为友好的错误消息。如果需要自定义，可以使用 `skipErrorHandler` 选项。

4. **向后兼容**: 迁移过程中可以逐步替换，不需要一次性全部迁移。

## 需要帮助？

如果遇到问题，请查看 [README.md](./README.md) 或提交 issue。
