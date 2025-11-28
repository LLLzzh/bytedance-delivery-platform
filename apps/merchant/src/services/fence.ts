import { FenceData } from "../pages/FenceConfig/types";

// 假设后端 API 基础路径
//const API_BASE_URL = '/api/fences';

// 通用请求处理函数，有后端数据时可替换为实际请求库
/*
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      // 'Authorization': 'Bearer token' // 如果需要鉴权
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
}
*/

export const fenceService = {
  // 获取围栏列表
  getFences: async (): Promise<FenceData[]> => {
    // 真实接口调用示例：
    // return request<FenceData[]>(API_BASE_URL);

    // 模拟数据返回
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          {
            id: 1,
            fence_name: "已保存围栏1",
            fence_desc: "测试描述",
            rule_id: 101,
            shape_type: "circle",
            coordinates: [[116.397428, 39.90923]],
            radius: 1000,
          },
        ]);
      }, 500);
    });
  },

  // 新增围栏
  createFence: async (data: FenceData): Promise<FenceData> => {
    // return request<FenceData>(API_BASE_URL, {
    //   method: 'POST',
    //   body: JSON.stringify(data),
    // });

    console.log("Create fence:", data);
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ ...data, id: Date.now() });
      }, 500);
    });
  },

  // 更新围栏
  updateFence: async (data: FenceData): Promise<FenceData> => {
    if (!data.id) throw new Error("Missing fence ID for update");
    // return request<FenceData>(`${API_BASE_URL}/${data.id}`, {
    //   method: 'PUT',
    //   body: JSON.stringify(data),
    // });

    console.log("Update fence:", data);
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(data);
      }, 500);
    });
  },

  // 删除围栏
  deleteFence: async (id: string | number): Promise<void> => {
    // return request<void>(`${API_BASE_URL}/${id}`, {
    //   method: 'DELETE',
    // });

    console.log("Delete fence:", id);
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 500);
    });
  },
};
