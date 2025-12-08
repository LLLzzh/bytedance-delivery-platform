import * as FenceRepository from "./fence.repository.js";
import { FenceData, CreateFenceDTO } from "./fence.types.js";

const MOCK_MERCHANT_ID = "10001";

// ----------------------------------------------------------------------
// CREATE Service: 创建围栏
// ----------------------------------------------------------------------
export async function createFenceData(
  data: CreateFenceDTO
): Promise<FenceData> {
  console.log("Creating fence with data:", data);
  // 可以在这里添加更复杂的业务逻辑，例如：检查围栏命名是否重复
  const newFence = await FenceRepository.createFence(data, MOCK_MERCHANT_ID);
  return newFence;
}

// ----------------------------------------------------------------------
// READ Service: 获取所有围栏
// ----------------------------------------------------------------------
export async function findAllFences(): Promise<FenceData[]> {
  return await FenceRepository.findAllFences(MOCK_MERCHANT_ID);
}

// ----------------------------------------------------------------------
// READ Service: 获取单个围栏
// ----------------------------------------------------------------------
export async function getFenceById(fenceId: number): Promise<FenceData> {
  const fence = await FenceRepository.findFenceById(fenceId, MOCK_MERCHANT_ID);

  if (!fence) {
    throw new Error(`Fence ID ${fenceId} not found.`);
  }
  return fence;
}

// ----------------------------------------------------------------------
// UPDATE Service: 更新围栏
// ----------------------------------------------------------------------
export async function updateFenceData(
  fenceId: number,
  data: CreateFenceDTO
): Promise<FenceData> {
  // ... 业务逻辑检查 ...
  const updatedFence = await FenceRepository.updateFence(
    fenceId,
    data,
    MOCK_MERCHANT_ID
  );

  if (!updatedFence) {
    throw new Error(`Fence ID ${fenceId} not found or update failed.`);
  }

  return updatedFence;
}

// ----------------------------------------------------------------------
// DELETE Service: 删除围栏
// ----------------------------------------------------------------------
export async function deleteFenceData(fenceId: number): Promise<boolean> {
  const deleted = await FenceRepository.deleteFence(fenceId, MOCK_MERCHANT_ID);

  // 可以在这里检查是否成功删除，并抛出错误
  // if (!deleted) { throw new Error('Delete failed.'); }

  return deleted;
}
