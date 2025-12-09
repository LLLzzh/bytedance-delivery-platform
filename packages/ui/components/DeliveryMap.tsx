/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState } from "react";
import AMapLoader from "@amap/amap-jsapi-loader";

// --- Configuration & Types ---

const AMAP_KEY = "b7a7a32ea42751cfdd896cc742d2cd08";
const AMAP_SECURITY_CODE = "60c4d15e036338526ec65a75e15ce16c";

const DEFAULT_TRUCK_ICON =
  "https://img.icons8.com/?size=100&id=BQjcRKZrKIEj&format=png&color=000000";

export interface DeliveryMapProps {
  /**
   * 骑手/车辆图标 URL
   */
  riderIconUrl?: string;
  /**
   * 完整路径坐标数组
   */
  pathCoordinates?: [number, number][];
  /**
   * 当前实时位置
   */
  currentPosition?: [number, number];
  /**
   * 已走过的路径坐标数组（用于动态渲染）
   */
  traveledPath?: [number, number][];
  /**
   * 是否启用动态路径渲染（逐步显示路径）
   * @default true
   */
  enableAnimatedPath?: boolean;
  /**
   * 路径动画速度（毫秒/点）
   * @default 100
   */
  pathAnimationSpeed?: number;
  /**
   * 地图容器 ID（如果提供，将使用该 ID 而不是自动生成）
   */
  containerId?: string;
  /**
   * 地图样式
   * @default "amap://styles/whitesmoke"
   */
  mapStyle?: string;
  /**
   * 是否自动调整视图以适应路径
   * @default true
   */
  autoFitView?: boolean;
  /**
   * 地图视图边距 [top, right, bottom, left]
   * @default [50, 50, 50, 50]
   */
  fitViewPadding?: [number, number, number, number];
  /**
   * 最大缩放级别
   * @default 18
   */
  maxZoom?: number;
}

/**
 * 使用 requestAnimationFrame 优化的路径渲染器
 */
class PathRenderer {
  private animationFrameId: number | null = null;
  private isAnimating = false;
  private currentIndex = 0;
  private fullPath: [number, number][] = [];
  private polylineRef: any = null;
  private onUpdate?: (path: [number, number][]) => void;
  private speed: number; // 毫秒/点
  private lastUpdateTime: number = 0;

  constructor(speed: number = 100) {
    this.speed = speed;
  }

  /**
   * 开始动画渲染路径
   */
  start(
    fullPath: [number, number][],
    polylineRef: any,
    onUpdate?: (path: [number, number][]) => void
  ) {
    if (this.isAnimating) {
      this.stop();
    }

    this.fullPath = fullPath;
    this.polylineRef = polylineRef;
    this.onUpdate = onUpdate;
    this.currentIndex = 0;
    this.isAnimating = true;
    this.lastUpdateTime = performance.now();

    this.animate();
  }

  /**
   * 停止动画
   */
  stop() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.isAnimating = false;
  }

  /**
   * 直接设置完整路径（不动画）
   */
  setPath(path: [number, number][]) {
    this.stop();
    this.fullPath = path;
    if (this.polylineRef && path.length > 0) {
      this.polylineRef.setPath(path);
      if (this.onUpdate) {
        this.onUpdate(path);
      }
    }
  }

  /**
   * 动画循环 - 完全使用 requestAnimationFrame
   */
  private animate = () => {
    if (!this.isAnimating || this.currentIndex >= this.fullPath.length) {
      this.isAnimating = false;
      return;
    }

    const now = performance.now();
    const elapsed = now - this.lastUpdateTime;

    // 根据速度计算应该添加多少个点
    if (elapsed >= this.speed) {
      const pointsToAdd = Math.floor(elapsed / this.speed);
      const newIndex = Math.min(
        this.currentIndex + pointsToAdd,
        this.fullPath.length
      );

      if (newIndex > this.currentIndex) {
        const currentPath = this.fullPath.slice(0, newIndex);
        if (this.polylineRef && currentPath.length > 0) {
          this.polylineRef.setPath(currentPath);
          if (this.onUpdate) {
            this.onUpdate(currentPath);
          }
        }
        this.currentIndex = newIndex;
        this.lastUpdateTime = now;
      }
    }

    if (this.currentIndex < this.fullPath.length && this.isAnimating) {
      this.animationFrameId = requestAnimationFrame(this.animate);
    } else {
      this.isAnimating = false;
    }
  };

  /**
   * 销毁渲染器
   */
  destroy() {
    this.stop();
    this.fullPath = [];
    this.polylineRef = null;
    this.onUpdate = undefined;
  }
}

/**
 * 使用 requestAnimationFrame 优化的标记移动器
 */
class MarkerMover {
  private animationFrameId: number | null = null;
  private isAnimating = false;
  private startPos: [number, number] | null = null;
  private targetPos: [number, number] | null = null;
  private markerRef: any = null;
  private mapRef: any = null;
  private startTime: number = 0;
  private duration: number = 1000;
  private onComplete?: () => void;

  /**
   * 平滑移动到目标位置
   */
  moveTo(
    markerRef: any,
    mapRef: any,
    targetPos: [number, number],
    duration: number = 1000,
    onComplete?: () => void
  ) {
    if (this.isAnimating) {
      this.stop();
    }

    this.markerRef = markerRef;
    this.mapRef = mapRef;
    this.targetPos = targetPos;
    this.duration = duration;
    this.onComplete = onComplete;

    if (!markerRef) return;

    const currentPos = markerRef.getPosition();
    if (!currentPos) {
      // 如果标记没有位置，直接设置
      markerRef.setPosition(targetPos);
      if (onComplete) onComplete();
      return;
    }

    this.startPos = [currentPos.lng, currentPos.lat];
    this.isAnimating = true;
    this.startTime = performance.now();

    this.animate();
  }

  /**
   * 停止动画
   */
  stop() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.isAnimating = false;
  }

  /**
   * 动画循环
   */
  private animate = () => {
    if (
      !this.isAnimating ||
      !this.markerRef ||
      !this.targetPos ||
      !this.startPos
    ) {
      this.isAnimating = false;
      if (this.onComplete) {
        this.onComplete();
      }
      return;
    }

    const elapsed = performance.now() - this.startTime;
    const progress = Math.min(elapsed / this.duration, 1);

    // 使用缓动函数（ease-out）
    const easeOut = 1 - Math.pow(1 - progress, 3);

    // 计算当前位置
    const currentLng =
      this.startPos[0] + (this.targetPos[0] - this.startPos[0]) * easeOut;
    const currentLat =
      this.startPos[1] + (this.targetPos[1] - this.startPos[1]) * easeOut;

    // 更新标记位置
    this.markerRef.setPosition([currentLng, currentLat]);

    // 计算角度（朝向目标方向）
    if (progress > 0 && progress < 1) {
      const angle = this.calculateAngle(this.startPos, this.targetPos);
      this.markerRef.setAngle(angle);
    }

    if (progress < 1) {
      this.animationFrameId = requestAnimationFrame(this.animate);
    } else {
      this.isAnimating = false;
      if (this.onComplete) {
        this.onComplete();
      }
    }
  };

  /**
   * 计算两点之间的角度
   */
  private calculateAngle(
    start: [number, number],
    end: [number, number]
  ): number {
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  }

  /**
   * 销毁移动器
   */
  destroy() {
    this.stop();
    this.markerRef = null;
    this.mapRef = null;
    this.startPos = null;
    this.targetPos = null;
    this.onComplete = undefined;
  }
}

/**
 * DeliveryMap 组件
 *
 * 一个高性能的物流轨迹地图组件，支持动态路径渲染和实时位置更新
 */
export const DeliveryMap: React.FC<DeliveryMapProps> = ({
  riderIconUrl = DEFAULT_TRUCK_ICON,
  pathCoordinates = [],
  currentPosition,
  traveledPath,
  enableAnimatedPath = true,
  pathAnimationSpeed = 100,
  containerId,
  mapStyle = "amap://styles/whitesmoke",
  autoFitView = true,
  fitViewPadding = [50, 50, 50, 50],
  maxZoom = 18,
}) => {
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const traveledPolylineRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pathRendererRef = useRef<PathRenderer | null>(null);
  const markerMoverRef = useRef<MarkerMover | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapContainerId] = useState(
    () =>
      containerId || `delivery-map-${Math.random().toString(36).substr(2, 9)}`
  );

  // 初始化地图
  useEffect(() => {
    // Security Configuration (Crucial for AMap JS API v2.0+)
    (window as any)._AMapSecurityConfig = {
      securityJsCode: AMAP_SECURITY_CODE,
    };

    let isMounted = true;

    AMapLoader.load({
      key: AMAP_KEY,
      version: "2.0",
      plugins: ["AMap.MoveAnimation", "AMap.Polyline", "AMap.Marker"],
    })
      .then((AMap) => {
        if (!isMounted) return;

        const container = document.getElementById(mapContainerId);
        if (!container) {
          console.error("Map container not found");
          return;
        }

        // 容器已准备好

        const map = new AMap.Map(mapContainerId, {
          viewMode: "3D",
          zoom: 10,
          center: pathCoordinates[0] ||
            currentPosition || [120.153576, 30.287459],
          mapStyle: mapStyle,
          pitch: 30,
        });

        mapRef.current = map;

        // 创建完整路径（灰色，已规划）
        if (pathCoordinates.length > 0) {
          const routePolyline = new AMap.Polyline({
            path: pathCoordinates,
            showDir: true,
            strokeColor: "#CCCCCC",
            strokeWeight: 4,
            strokeOpacity: 0.6,
            strokeStyle: "dashed",
            zIndex: 2, // 降低 z-index，确保不会覆盖底部面板
            map: map,
          });
          polylineRef.current = routePolyline;
        }

        // 创建已走过的路径（蓝色，实线）
        if (traveledPath && traveledPath.length > 0) {
          const traveledPolyline = new AMap.Polyline({
            path: traveledPath,
            showDir: true,
            strokeColor: "#1890ff",
            strokeWeight: 6,
            strokeOpacity: 0.8,
            zIndex: 3, // 降低 z-index，确保不会覆盖底部面板
            map: map,
          });
          traveledPolylineRef.current = traveledPolyline;
        } else if (pathCoordinates.length > 0 && enableAnimatedPath) {
          // 如果没有已走过的路径，初始化路径渲染器
          const traveledPolyline = new AMap.Polyline({
            path: [],
            showDir: true,
            strokeColor: "#1890ff",
            strokeWeight: 6,
            strokeOpacity: 0.8,
            zIndex: 3, // 降低 z-index，确保不会覆盖底部面板
            map: map,
          });
          traveledPolylineRef.current = traveledPolyline;

          // 初始化路径渲染器
          if (!pathRendererRef.current) {
            pathRendererRef.current = new PathRenderer(pathAnimationSpeed);
          }
        }

        // 创建车辆标记
        const markerPosition = currentPosition ||
          pathCoordinates[0] || [120.153576, 30.287459];
        const marker = new AMap.Marker({
          map: map,
          position: markerPosition,
          content: `
            <div style="display: flex; justify-content: center; align-items: center;">
              <img src="${riderIconUrl}" style="width: 32px; height: 32px; display: block;" />
            </div>
          `,
          offset: new AMap.Pixel(0, 0),
          anchor: "center",
          zIndex: 5, // 降低 z-index，确保不会覆盖底部面板（面板 z-index 为 10）
          angle: 0,
        });
        markerRef.current = marker;

        // 初始化标记移动器
        if (!markerMoverRef.current) {
          markerMoverRef.current = new MarkerMover();
        }

        // 调整视图以适应路径
        if (autoFitView && (pathCoordinates.length > 0 || currentPosition)) {
          const objectsToFit: any[] = [];
          if (marker) objectsToFit.push(marker);
          if (polylineRef.current) objectsToFit.push(polylineRef.current);
          if (traveledPolylineRef.current)
            objectsToFit.push(traveledPolylineRef.current);

          if (objectsToFit.length > 0) {
            map.setFitView(objectsToFit, false, fitViewPadding, maxZoom);
          }
        }

        setIsMapReady(true);
      })
      .catch((e) => {
        console.error("AMap load failed", e);
      });

    return () => {
      isMounted = false;
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
      if (pathRendererRef.current) {
        pathRendererRef.current.destroy();
        pathRendererRef.current = null;
      }
      if (markerMoverRef.current) {
        markerMoverRef.current.destroy();
        markerMoverRef.current = null;
      }
    };
  }, [mapContainerId, mapStyle]); // 只在初始化时执行

  // 监听容器大小变化
  useEffect(() => {
    if (!isMapReady || !containerRef.current || !mapRef.current) return;

    const container = containerRef.current;
    const map = mapRef.current;

    // 使用 ResizeObserver 监听容器大小变化
    resizeObserverRef.current = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          // 使用 requestAnimationFrame 优化地图大小调整
          requestAnimationFrame(() => {
            if (map && !map.destroyed) {
              map.getSize();
              map.resize();
            }
          });
        }
      }
    });

    resizeObserverRef.current.observe(container);

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
    };
  }, [isMapReady]);

  // 处理路径更新
  useEffect(() => {
    if (!isMapReady || !polylineRef.current) return;

    if (pathCoordinates.length > 0) {
      polylineRef.current.setPath(pathCoordinates);

      // 如果启用动画路径且没有已走过的路径，开始动画渲染
      if (
        enableAnimatedPath &&
        !traveledPath &&
        pathRendererRef.current &&
        traveledPolylineRef.current
      ) {
        pathRendererRef.current.start(
          pathCoordinates,
          traveledPolylineRef.current,
          () => {
            // 路径更新回调，可以在这里调整视图
            if (autoFitView && mapRef.current && markerRef.current) {
              const objectsToFit: any[] = [markerRef.current];
              if (traveledPolylineRef.current) {
                objectsToFit.push(traveledPolylineRef.current);
              }
              requestAnimationFrame(() => {
                if (mapRef.current && !mapRef.current.destroyed) {
                  mapRef.current.setFitView(
                    objectsToFit,
                    false,
                    fitViewPadding,
                    maxZoom
                  );
                }
              });
            }
          }
        );
      }
    }
  }, [
    pathCoordinates,
    enableAnimatedPath,
    autoFitView,
    fitViewPadding,
    maxZoom,
    isMapReady,
    traveledPath,
  ]);

  // 处理已走过的路径更新
  useEffect(() => {
    if (!isMapReady || !traveledPolylineRef.current) return;

    if (traveledPath && traveledPath.length > 0) {
      // 如果有已走过的路径，直接设置（不动画）
      traveledPolylineRef.current.setPath(traveledPath);

      // 调整视图以适应新路径
      if (autoFitView && mapRef.current) {
        const objectsToFit: any[] = [];
        if (markerRef.current) objectsToFit.push(markerRef.current);
        if (traveledPolylineRef.current)
          objectsToFit.push(traveledPolylineRef.current);

        requestAnimationFrame(() => {
          if (
            mapRef.current &&
            !mapRef.current.destroyed &&
            objectsToFit.length > 0
          ) {
            mapRef.current.setFitView(
              objectsToFit,
              false,
              fitViewPadding,
              maxZoom
            );
          }
        });
      }
    }
  }, [traveledPath, autoFitView, fitViewPadding, maxZoom, isMapReady]);

  // 处理实时位置更新
  useEffect(() => {
    if (!isMapReady || !markerRef.current || !currentPosition) return;

    // 使用 requestAnimationFrame 优化的移动器
    if (markerMoverRef.current) {
      markerMoverRef.current.moveTo(
        markerRef.current,
        mapRef.current,
        currentPosition,
        1000, // 1秒动画
        () => {
          // 移动完成后，调整视图
          if (autoFitView && mapRef.current && markerRef.current) {
            const objectsToFit: any[] = [markerRef.current];
            if (traveledPolylineRef.current) {
              objectsToFit.push(traveledPolylineRef.current);
            }
            requestAnimationFrame(() => {
              if (mapRef.current && !mapRef.current.destroyed) {
                mapRef.current.setFitView(
                  objectsToFit,
                  false,
                  fitViewPadding,
                  maxZoom
                );
              }
            });
          }
        }
      );
    } else {
      // 如果没有移动器，直接设置位置
      markerRef.current.setPosition(currentPosition);
    }
  }, [currentPosition, autoFitView, fitViewPadding, maxZoom, isMapReady]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "#f0f0f0",
        zIndex: 1, // 确保地图容器在底部面板（z-index: 10）之下
      }}
    >
      <div
        id={mapContainerId}
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          zIndex: 1, // 确保地图本身也在底部面板之下
        }}
      />
    </div>
  );
};
