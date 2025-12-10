import { createApiClient } from "@repo/http-client";

export const apiClient = createApiClient({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000",
  timeout: 30000,
  enableAuth: true,
  getToken: () => localStorage.getItem("token"),
  onAuthError: () => {
    localStorage.removeItem("token");
    // 可以跳转到登录页
    // window.location.href = '/login';
  },
});
