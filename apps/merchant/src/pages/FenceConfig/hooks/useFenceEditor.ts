import { useState, useRef, useCallback } from "react";
import { FenceData } from "../types";
import { MapContainerRef } from "../components/MapContainer";

/**
 * Custom hook 管理围栏编辑状态
 * 确保保存时总是从地图覆盖物获取最新的坐标数据
 */
export function useFenceEditor(mapRef: React.RefObject<MapContainerRef>) {
  const [currentFence, setCurrentFence] = useState<Partial<FenceData> | null>(
    null
  );
  const [panelVisible, setPanelVisible] = useState(false);

  // 记录当前正在编辑的围栏 ID，用于保存时查找覆盖物
  const editingFenceIdRef = useRef<string | number | undefined>(undefined);

  /**
   * 开始编辑围栏
   */
  const startEdit = useCallback((fence: FenceData) => {
    setCurrentFence(fence);
    setPanelVisible(true);
    editingFenceIdRef.current = fence.id;
  }, []);

  /**
   * 绘制完成
   */
  const onDrawComplete = useCallback((data: Partial<FenceData>) => {
    setCurrentFence(data);
    setPanelVisible(true);
    editingFenceIdRef.current = undefined; // 新建围栏还没有 id
  }, []);

  /**
   * 编辑完成（坐标更新）
   */
  const onEditComplete = useCallback((data: Partial<FenceData>) => {
    setCurrentFence((prev) => {
      if (!prev) return data;
      return { ...prev, ...data };
    });
  }, []);

  /**
   * 取消编辑
   */
  const cancelEdit = useCallback(() => {
    setPanelVisible(false);
    setCurrentFence(null);
    editingFenceIdRef.current = undefined;
  }, []);

  /**
   * 获取最新的围栏数据（用于保存）
   * 优先从地图覆盖物获取，确保获取到最新的坐标
   */
  const getLatestFenceData = useCallback(
    (formValues: Partial<FenceData>): FenceData => {
      // 1. 优先从地图覆盖物获取最新坐标（最准确）
      let latestCoordinates = formValues.coordinates || [];
      let latestRadius = formValues.radius ?? 0;
      let latestShapeType = formValues.shape_type || "polygon";

      if (mapRef.current?.getCurrentOverlayData) {
        // 使用 editingFenceIdRef 或 formValues.id 来查找覆盖物
        const fenceId = editingFenceIdRef.current || formValues.id;
        const overlayData = mapRef.current.getCurrentOverlayData(fenceId);

        if (overlayData) {
          if (overlayData.coordinates && overlayData.coordinates.length > 0) {
            latestCoordinates = overlayData.coordinates;
            console.log(
              "✓ Got latest coordinates from overlay:",
              latestCoordinates
            );
          }
          if (overlayData.radius !== undefined) {
            latestRadius = overlayData.radius;
          }
          if (overlayData.shape_type) {
            latestShapeType = overlayData.shape_type;
          }
        } else {
          console.log(
            "⚠ getCurrentOverlayData returned null, using form values or currentFence"
          );
          // 如果无法从覆盖物获取，尝试使用 currentFence
          if (
            currentFence?.coordinates &&
            currentFence.coordinates.length > 0
          ) {
            latestCoordinates = currentFence.coordinates;
            console.log(
              "✓ Using coordinates from currentFence:",
              latestCoordinates
            );
          }
          if (currentFence?.radius !== undefined) {
            latestRadius = currentFence.radius;
          }
          if (currentFence?.shape_type) {
            latestShapeType = currentFence.shape_type;
          }
        }
      } else {
        // 如果 mapRef 不可用，使用 currentFence
        if (currentFence?.coordinates && currentFence.coordinates.length > 0) {
          latestCoordinates = currentFence.coordinates;
          console.log(
            "✓ Using coordinates from currentFence (mapRef not available):",
            latestCoordinates
          );
        }
        if (currentFence?.radius !== undefined) {
          latestRadius = currentFence.radius;
        }
        if (currentFence?.shape_type) {
          latestShapeType = currentFence.shape_type;
        }
      }

      // 合并所有数据
      const finalData: FenceData = {
        ...formValues,
        coordinates: latestCoordinates,
        shape_type: latestShapeType,
        radius: latestRadius,
      } as FenceData;

      console.log("📦 Final fence data to save:", {
        id: finalData.id,
        name: finalData.fence_name,
        coordinates: finalData.coordinates,
        shape_type: finalData.shape_type,
        radius: finalData.radius,
      });

      return finalData;
    },
    [mapRef, currentFence]
  );

  /**
   * 保存完成后的清理
   */
  const onSaveComplete = useCallback(() => {
    setPanelVisible(false);
    setCurrentFence(null);
    editingFenceIdRef.current = undefined;
  }, []);

  return {
    currentFence,
    panelVisible,
    startEdit,
    onDrawComplete,
    onEditComplete,
    cancelEdit,
    getLatestFenceData,
    onSaveComplete,
  };
}
