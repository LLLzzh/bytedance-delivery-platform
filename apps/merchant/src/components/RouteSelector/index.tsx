/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { Modal, List, Tag, Button, Typography, Spin, message } from "antd";
import AMapLoader from "@amap/amap-jsapi-loader";

interface RouteSelectorProps {
  open?: boolean;
  onClose?: () => void;
  onConfirm?: (route: any) => void;
  startLngLat: [number, number]; // [lng, lat]
  endLngLat: [number, number]; // [lng, lat]
  waypoints?: [number, number][]; // 途经点
  mode?: "modal" | "inline";
  extraTime?: number; // 额外的耗时（秒），例如中转站停留时间
}

export default function RouteSelector({
  open,
  onClose,
  onConfirm,
  startLngLat,
  endLngLat,
  waypoints = [],
  mode = "modal",
  extraTime = 0,
}: RouteSelectorProps) {
  const mapRef = useRef<any>(null);
  const [loading, setLoading] = useState(false);
  const [routes, setRoutes] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const polylinesRef = useRef<any[]>([]);

  // 初始化地图
  useEffect(() => {
    if (mode === "modal" && !open) return;

    // 设置安全密钥
    (window as any)._AMapSecurityConfig = {
      securityJsCode: "60c4d15e036338526ec65a75e15ce16c", // 请替换为你的安全密钥
    };

    AMapLoader.load({
      key: "b7a7a32ea42751cfdd896cc742d2cd08", // 替换为你的 Key
      version: "2.0",
      plugins: ["AMap.Driving"],
    })
      .then((AMap) => {
        if (!mapRef.current) {
          const map = new AMap.Map("route-map-container", {
            zoom: 12,
            center: startLngLat,
          });
          mapRef.current = map;
        }

        planRoutes(AMap);
      })
      .catch((e) => {
        console.error(e);
        message.error("地图加载失败");
      });

    return () => {
      // Modal 关闭时不销毁地图实例，避免重复创建开销，或者可以在 onClose 中手动销毁
      // 这里为了简单，每次 open 重新规划，但地图实例复用
    };
  }, [open, startLngLat, endLngLat, waypoints]);

  const planRoutes = async (AMap: any) => {
    if (!mapRef.current) return;
    setLoading(true);

    // 清除旧的覆盖物
    mapRef.current.clearMap();
    polylinesRef.current = [];

    // 绘制起点终点 Marker
    new AMap.Marker({
      position: startLngLat,
      icon: "https://webapi.amap.com/theme/v1.3/markers/n/start.png",
      map: mapRef.current,
    });
    new AMap.Marker({
      position: endLngLat,
      icon: "https://webapi.amap.com/theme/v1.3/markers/n/end.png",
      map: mapRef.current,
    });

    // 绘制途经点 Marker
    if (waypoints && waypoints.length > 0) {
      waypoints.forEach((point, index) => {
        new AMap.Marker({
          position: point,
          content: `<div style="background-color: #1890ff; color: #fff; border-radius: 50%; width: 20px; height: 20px; text-align: center; line-height: 20px; font-size: 12px;">${index + 1}</div>`,
          map: mapRef.current,
          offset: new AMap.Pixel(-10, -10),
        });
      });
    }

    // 定义多种策略以获取多条路线
    // 0: LEAST_TIME (最快), 2: LEAST_DISTANCE (最短), 1: LEAST_FEE (避开高速/省钱)
    const policies = [
      { code: 0, label: "推荐方案" },
      { code: 2, label: "最短距离" },
      { code: 1, label: "经济路线" },
    ];

    const fetchRoute = (policy: number) => {
      return new Promise<any>((resolve) => {
        const driving = new AMap.Driving({
          policy: policy,
          map: null,
        });
        driving.search(
          startLngLat,
          endLngLat,
          { waypoints: waypoints },
          (status: string, result: any) => {
            if (
              status === "complete" &&
              result.routes &&
              result.routes.length
            ) {
              resolve(result.routes[0]); // 取该策略下的第一条
            } else {
              resolve(null);
            }
          }
        );
      });
    };

    try {
      // 并行请求不同策略的路线
      const results = await Promise.all(
        policies.map((p) => fetchRoute(p.code))
      );

      // 过滤无效结果并去重
      const uniqueRoutes: any[] = [];
      const seenKeys = new Set<string>();

      results.forEach((route) => {
        if (route) {
          // 简单的去重键：距离+时间
          const key = `${route.distance}-${route.time}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            uniqueRoutes.push(route);
          }
        }
      });

      if (uniqueRoutes.length > 0) {
        setRoutes(uniqueRoutes);
        setSelectedIndex(0);
        drawRoutes(AMap, uniqueRoutes, 0);
      } else {
        message.warning("未找到合适路径");
      }
    } catch (error) {
      console.error("Route planning error:", error);
      message.error("路径规划出错");
    } finally {
      setLoading(false);
    }
  };

  const drawRoutes = (AMap: any, allRoutes: any[], activeIndex: number) => {
    // 清除之前的线
    mapRef.current.remove(polylinesRef.current);
    polylinesRef.current = [];

    allRoutes.forEach((route, index) => {
      const isActive = index === activeIndex;
      const path = parseRouteToPath(route);

      const polyline = new AMap.Polyline({
        path: path,
        isOutline: true,
        outlineColor: "#ffeeff",
        borderWeight: 1,
        strokeColor: isActive ? "#3366FF" : "#999999", // 选中蓝色，未选中灰色
        strokeOpacity: 1,
        strokeWeight: isActive ? 6 : 4,
        strokeStyle: "solid",
        lineJoin: "round",
        lineCap: "round",
        zIndex: isActive ? 50 : 10, // 选中的在上面
        map: mapRef.current,
        cursor: "pointer",
      });

      // 点击线路也可以切换
      polyline.on("click", () => {
        setSelectedIndex(index);
        drawRoutes(AMap, allRoutes, index); // 重绘以更新样式
      });

      polylinesRef.current.push(polyline);
    });

    mapRef.current.setFitView();
  };

  const parseRouteToPath = (route: any) => {
    const path: any[] = [];
    route.steps.forEach((step: any) => {
      step.path.forEach((p: any) => {
        path.push([p.lng, p.lat]);
      });
    });
    return path;
  };

  const handleSelectRoute = (index: number) => {
    setSelectedIndex(index);
    if (mapRef.current && (window as any).AMap) {
      drawRoutes((window as any).AMap, routes, index);
    }
  };

  const formatTime = (seconds: number) => {
    const totalSeconds = seconds + extraTime;
    const min = Math.ceil(totalSeconds / 60);
    const hours = Math.floor(min / 60);
    const mins = min % 60;

    let timeStr = "";
    if (hours > 0) {
      timeStr += `${hours}小时`;
    }
    if (mins > 0 || hours === 0) {
      timeStr += `${mins}分`;
    }

    // 如果有额外时间，显示详情
    if (extraTime > 0) {
      const extraHours = (extraTime / 3600).toFixed(1);
      return (
        <span>
          {timeStr}{" "}
          <span style={{ fontSize: 12, color: "#999" }}>
            (含中转{extraHours}h)
          </span>
        </span>
      );
    }

    return timeStr;
  };

  const formatDistance = (meters: number) => {
    return meters > 1000 ? `${(meters / 1000).toFixed(1)}km` : `${meters}m`;
  };

  const content = (
    <div
      style={{
        display: "flex",
        height: mode === "inline" ? "300px" : "500px",
        gap: "16px",
      }}
    >
      {/* 左侧地图 */}
      <div
        style={{
          flex: 1,
          position: "relative",
          borderRadius: "8px",
          overflow: "hidden",
          border: "1px solid #f0f0f0",
        }}
      >
        {loading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(255,255,255,0.7)",
              zIndex: 100,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Spin tip="路径规划中..." />
          </div>
        )}
        <div
          id="route-map-container"
          style={{ width: "100%", height: "100%" }}
        />
      </div>

      {/* 右侧列表 */}
      <div style={{ width: "300px", overflowY: "auto" }}>
        <Typography.Title level={5} style={{ marginTop: 0 }}>
          备选方案 ({routes.length})
        </Typography.Title>
        <List
          dataSource={routes}
          renderItem={(item, index) => (
            <List.Item
              onClick={() => handleSelectRoute(index)}
              style={{
                cursor: "pointer",
                background: selectedIndex === index ? "#e6f7ff" : "transparent",
                border:
                  selectedIndex === index
                    ? "1px solid #1890ff"
                    : "1px solid #f0f0f0",
                borderRadius: "6px",
                marginBottom: "8px",
                padding: "12px",
                transition: "all 0.3s",
              }}
            >
              <div style={{ width: "100%" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "4px",
                  }}
                >
                  <span style={{ fontWeight: "bold" }}>方案 {index + 1}</span>
                  {index === 0 && <Tag color="green">推荐</Tag>}
                </div>
                <div style={{ color: "#666", fontSize: "13px" }}>
                  <div>
                    预计耗时：
                    <span style={{ color: "#faad14", fontWeight: "bold" }}>
                      {formatTime(item.time)}
                    </span>
                  </div>
                  <div>路程距离：{formatDistance(item.distance)}</div>
                  <div>红绿灯数：{item.traffic_lights || 0} 个</div>
                </div>
              </div>
            </List.Item>
          )}
        />
      </div>
    </div>
  );

  if (mode === "inline") {
    return content;
  }

  return (
    <Modal
      title="选择配送路线"
      open={open}
      onCancel={onClose}
      width={900}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button
          key="confirm"
          type="primary"
          onClick={() => onConfirm && onConfirm(routes[selectedIndex])}
        >
          确认使用方案 {selectedIndex + 1}
        </Button>,
      ]}
    >
      {content}
    </Modal>
  );
}
