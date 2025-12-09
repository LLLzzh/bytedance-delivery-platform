/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import {
  Modal,
  Tag,
  Button,
  Typography,
  Spin,
  message,
  Flex,
  Space,
} from "antd";
import AMapLoader from "@amap/amap-jsapi-loader";

interface RouteSelectorProps {
  open?: boolean;
  onClose?: () => void;
  onConfirm?: (route: any) => void; // 在 inline 模式下，当路线更新时调用
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
  // 用于跟踪上次请求的参数，避免重复请求
  const lastRequestParamsRef = useRef<string>("");
  const isRequestingRef = useRef<boolean>(false);
  const hasResultRef = useRef<boolean>(false);

  // 生成请求参数的唯一标识
  const getRequestKey = (
    start: [number, number],
    end: [number, number],
    waypoints: [number, number][]
  ) => {
    const waypointsStr = waypoints.map((w) => `${w[0]},${w[1]}`).join("|");
    return `${start[0]},${start[1]}-${end[0]},${end[1]}-${waypointsStr}`;
  };

  // 初始化地图
  useEffect(() => {
    if (mode === "modal" && !open) {
      // Modal 关闭时重置状态
      hasResultRef.current = false;
      return;
    }

    const requestKey = getRequestKey(startLngLat, endLngLat, waypoints);

    // 如果参数没有变化且正在请求中，则不重复请求
    if (
      lastRequestParamsRef.current === requestKey &&
      isRequestingRef.current
    ) {
      return;
    }

    // 如果参数没有变化且已经请求过并得到结果，则不重复请求
    if (lastRequestParamsRef.current === requestKey && hasResultRef.current) {
      return;
    }

    // 如果参数变化了，重置结果状态
    if (lastRequestParamsRef.current !== requestKey) {
      hasResultRef.current = false;
      setRoutes([]);
    }

    // 更新请求参数标识
    lastRequestParamsRef.current = requestKey;
    isRequestingRef.current = true;

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
        isRequestingRef.current = false;
      });

    return () => {};
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

    const fetchRoute = (policy: number, index: number) => {
      return new Promise<{ route: any; error: string | null }>((resolve) => {
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
              resolve({ route: result.routes[0], error: null }); // 取该策略下的第一条
            } else if (status === "error" || status === "no_data") {
              // 检查是否有错误信息
              const errorInfo = result?.info || "";
              const errorCode = result?.infocode || "";

              // 检查是否是QPS超限错误
              if (
                errorInfo.includes("CUQPS_HAS_EXCEEDED_THE_LIMIT") ||
                errorInfo.includes("QPS") ||
                errorCode === "10021"
              ) {
                resolve({
                  route: null,
                  error: "QPS_LIMIT",
                });
              } else {
                // 其他错误
                console.warn(
                  `路径规划策略 ${policies[index].label} 失败:`,
                  errorInfo
                );
                resolve({ route: null, error: errorInfo || "路径规划失败" });
              }
            } else {
              resolve({ route: null, error: null });
            }
          }
        );
      });
    };

    try {
      // 添加延迟以避免并发请求过多导致QPS超限
      // 串行请求，每个请求间隔200ms
      const results: Array<{ route: any; error: string | null }> = [];
      for (let i = 0; i < policies.length; i++) {
        if (i > 0) {
          // 除了第一个请求，其他请求延迟执行
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
        const result = await fetchRoute(policies[i].code, i);
        results.push(result);
      }

      // 检查是否有QPS超限错误
      const qpsErrors = results.filter((r) => r.error === "QPS_LIMIT");
      if (qpsErrors.length > 0) {
        message.error("请求过于频繁，请稍后再试（QPS超限）");
        setLoading(false);
        return;
      }

      // 过滤无效结果并去重
      const uniqueRoutes: any[] = [];
      const seenKeys = new Set<string>();

      results.forEach((result) => {
        if (result.route) {
          // 简单的去重键：距离+时间
          const key = `${result.route.distance}-${result.route.time}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            uniqueRoutes.push(result.route);
          }
        }
      });

      if (uniqueRoutes.length > 0) {
        setRoutes(uniqueRoutes);
        setSelectedIndex(0);
        drawRoutes(AMap, uniqueRoutes, 0);
        hasResultRef.current = true; // 标记已有结果
        // 在 inline 模式下，自动通知父组件路线已更新
        if (mode === "inline" && onConfirm && uniqueRoutes[0]) {
          onConfirm(uniqueRoutes[0]);
        }
      } else {
        // 检查是否有其他错误信息
        const otherErrors = results.filter(
          (r) => r.error && r.error !== "QPS_LIMIT"
        );
        if (otherErrors.length > 0) {
          message.warning(`路径规划失败: ${otherErrors[0].error}`);
        } else {
          message.warning("未找到合适路径");
        }
      }
    } catch (error) {
      console.error("Route planning error:", error);
      message.error("路径规划出错");
    } finally {
      setLoading(false);
      isRequestingRef.current = false;
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
      // 在 inline 模式下，通知父组件路线已切换
      if (mode === "inline" && onConfirm && routes[index]) {
        onConfirm(routes[index]);
      }
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
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <Spin size="large" />
            <Typography.Text type="secondary">路径规划中...</Typography.Text>
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
        <Flex vertical gap={8}>
          {routes.map((item, index) => (
            <div
              key={index}
              onClick={() => handleSelectRoute(index)}
              style={{
                cursor: "pointer",
                background: selectedIndex === index ? "#e6f7ff" : "transparent",
                border:
                  selectedIndex === index
                    ? "1px solid #1890ff"
                    : "1px solid #f0f0f0",
                borderRadius: "6px",
                padding: "12px",
                transition: "all 0.3s",
              }}
            >
              <Flex
                justify="space-between"
                align="center"
                style={{ marginBottom: "4px" }}
              >
                <Typography.Text strong>方案 {index + 1}</Typography.Text>
                {index === 0 && <Tag color="green">推荐</Tag>}
              </Flex>
              <Space direction="vertical" size={4} style={{ width: "100%" }}>
                <div style={{ color: "#666", fontSize: "13px" }}>
                  预计耗时：
                  <span style={{ color: "#faad14", fontWeight: "bold" }}>
                    {formatTime(item.time)}
                  </span>
                </div>
                <div style={{ color: "#666", fontSize: "13px" }}>
                  路程距离：{formatDistance(item.distance)}
                </div>
                <div style={{ color: "#666", fontSize: "13px" }}>
                  红绿灯数：{item.traffic_lights || 0} 个
                </div>
              </Space>
            </div>
          ))}
        </Flex>
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
