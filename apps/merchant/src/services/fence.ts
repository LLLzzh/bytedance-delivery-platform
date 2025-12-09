import { apiClient } from "./api-client";
import type { FenceData } from "../pages/FenceConfig/types";

// 后端返回的格式（camelCase）
interface BackendFenceData {
  id: number;
  fenceName?: string;
  fenceDesc?: string;
  ruleId?: number | null;
  shapeType: "polygon" | "circle";
  coordinates: number[][];
  radius: number;
  geometry?: unknown;
}

interface FenceResponse {
  success: boolean;
  fence: BackendFenceData;
}

interface FenceListResponse {
  success: boolean;
  fences: BackendFenceData[];
}

// 数据转换：后端 camelCase -> 前端 snake_case
function backendToFrontend(backend: BackendFenceData): FenceData {
  return {
    id: backend.id,
    fence_name: backend.fenceName || "",
    fence_desc: backend.fenceDesc || "",
    rule_id: backend.ruleId ?? null,
    shape_type: backend.shapeType,
    coordinates: backend.coordinates,
    radius: backend.radius,
  };
}

// 数据转换：前端 snake_case -> 后端 camelCase
function frontendToBackend(
  frontend: Omit<FenceData, "id">
): Omit<BackendFenceData, "id" | "geometry"> {
  return {
    fenceName: frontend.fence_name,
    fenceDesc: frontend.fence_desc,
    ruleId: frontend.rule_id,
    shapeType: frontend.shape_type,
    coordinates: frontend.coordinates,
    radius: frontend.radius,
  };
}

export const fenceService = {
  /**
   * 获取围栏列表
   */
  async getFences(): Promise<FenceData[]> {
    const response = await apiClient
      .getInstance()
      .get<FenceListResponse>("/api/v1/fences");
    // 后端直接返回 { success: true, fences: [...] }
    const data = response.data as FenceListResponse;
    const backendFences = data?.fences || [];
    return backendFences.map(backendToFrontend);
  },

  /**
   * 获取单个围栏详情
   */
  async getFenceById(id: string | number): Promise<FenceData> {
    const response = await apiClient
      .getInstance()
      .get<FenceResponse>(`/api/v1/fences/${id}`);
    const data = response.data as FenceResponse;
    return backendToFrontend(data.fence);
  },

  /**
   * 创建围栏
   */
  async createFence(data: Omit<FenceData, "id">): Promise<FenceData> {
    const backendData = frontendToBackend(data);
    const response = await apiClient
      .getInstance()
      .post<FenceResponse>("/api/v1/fences", backendData);
    const resData = response.data as FenceResponse;
    return backendToFrontend(resData.fence);
  },

  /**
   * 更新围栏
   */
  async updateFence(
    id: string | number,
    data: Omit<FenceData, "id">
  ): Promise<FenceData> {
    const backendData = frontendToBackend(data);
    const response = await apiClient
      .getInstance()
      .put<FenceResponse>(`/api/v1/fences/${id}`, backendData);
    const resData = response.data as FenceResponse;
    return backendToFrontend(resData.fence);
  },

  /**
   * 删除围栏
   */
  async deleteFence(id: string | number): Promise<void> {
    await apiClient.getInstance().delete(`/api/v1/fences/${id}`);
  },
};
