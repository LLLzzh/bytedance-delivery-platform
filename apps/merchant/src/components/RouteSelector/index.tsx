/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { Modal, List, Tag, Button, Typography, Spin, message } from "antd";
import AMapLoader from "@amap/amap-jsapi-loader";

interface RouteSelectorProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (route: any) => void;
  startLngLat: [number, number]; // [lng, lat]
  endLngLat: [number, number]; // [lng, lat]
}

export default function RouteSelector({
  open,
  onClose,
  onConfirm,
  startLngLat,
  endLngLat,
}: RouteSelectorProps) {
  const mapRef = useRef<any>(null);
  const [loading, setLoading] = useState(false);
  const [routes, setRoutes] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const polylinesRef = useRef<any[]>([]);

  // 初始化地图
  useEffect(() => {
    if (!open) return;

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
  }, [open, startLngLat, endLngLat]);

  const planRoutes = (AMap: any) => {
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

    const driving = new AMap.Driving({
      policy: AMap.DrivingPolicy.LEAST_TIME, // 默认策略：最快
      map: null, // 我们自己绘制，不使用默认绘制
    });

    // 搜索路径
    driving.search(startLngLat, endLngLat, (status: string, result: any) => {
      setLoading(false);
      if (status === "complete") {
        if (result.routes && result.routes.length) {
          setRoutes(result.routes);
          setSelectedIndex(0); // 默认选中第一条
          drawRoutes(AMap, result.routes, 0);
        }
      } else {
        message.error("路径规划失败: " + result);
      }
    });
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
    const min = Math.ceil(seconds / 60);
    return min > 60 ? `${Math.floor(min / 60)}小时${min % 60}分` : `${min}分钟`;
  };

  const formatDistance = (meters: number) => {
    return meters > 1000 ? `${(meters / 1000).toFixed(1)}km` : `${meters}m`;
  };

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
          onClick={() => onConfirm(routes[selectedIndex])}
        >
          确认使用方案 {selectedIndex + 1}
        </Button>,
      ]}
    >
      <div style={{ display: "flex", height: "500px", gap: "16px" }}>
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
                  background:
                    selectedIndex === index ? "#e6f7ff" : "transparent",
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
    </Modal>
  );
}
