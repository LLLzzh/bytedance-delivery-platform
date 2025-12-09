# 快速开始

5 分钟内上手使用 `@repo/http-client`。

## 1. 安装

```bash
pnpm add @repo/http-client
```

## 2. 创建客户端

在你的应用入口或 API 服务文件中：

```typescript
import { createApiClient } from "@repo/http-client";

const apiClient = createApiClient({
  baseURL: "http://localhost:3000", // 或使用环境变量
  enableAuth: true,
  getToken: () => localStorage.getItem("token"),
  onAuthError: () => {
    // token 失效时的处理
    localStorage.removeItem("token");
    window.location.href = "/login";
  },
});
```

## 3. 发送请求

```typescript
// GET 请求
const users = await apiClient.get("/api/users");
console.log(users.data);

// POST 请求
const newUser = await apiClient.post("/api/users", {
  name: "John",
  email: "john@example.com",
});
console.log(newUser.data);

// PUT 请求
const updated = await apiClient.put("/api/users/1", {
  name: "John Updated",
});

// DELETE 请求
await apiClient.delete("/api/users/1");
```

## 4. 在 React 组件中使用

```typescript
import { useEffect, useState } from 'react';
import { createApiClient } from '@repo/http-client';

const apiClient = createApiClient({
  baseURL: 'http://localhost:3000',
});

function UserList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const response = await apiClient.get('/api/users');
        setUsers(response.data || []);
      } catch (error) {
        console.error('加载用户失败:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, []);

  if (loading) return <div>加载中...</div>;

  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

## 5. 创建服务层（推荐）

将 API 调用封装到服务层，便于复用和维护：

```typescript
// src/services/userService.ts
import { createApiClient } from "@repo/http-client";

const apiClient = createApiClient({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000",
});

export const userService = {
  async getUsers() {
    const response = await apiClient.get("/api/users");
    return response.data;
  },

  async getUserById(id: string) {
    const response = await apiClient.get(`/api/users/${id}`);
    return response.data;
  },

  async createUser(data: { name: string; email: string }) {
    const response = await apiClient.post("/api/users", data);
    return response.data;
  },
};
```

然后在组件中使用：

```typescript
import { userService } from "./services/userService";

const users = await userService.getUsers();
```

## 完成！

你现在可以开始使用 `@repo/http-client` 了。

更多信息请查看：

- [完整文档](./README.md)
- [迁移指南](./MIGRATION.md)
- [使用示例](./example.ts)
