/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState } from "react";
import AMapLoader from "@amap/amap-jsapi-loader";
import { Button, Card, Typography, Space } from "antd";
import { UpOutlined, DownOutlined, CarOutlined } from "@ant-design/icons";

// --- Configuration & Types ---

const AMAP_KEY = "b7a7a32ea42751cfdd896cc742d2cd08";
const AMAP_SECURITY_CODE = "60c4d15e036338526ec65a75e15ce16c";

interface DeliveryMapProps {
  riderIconUrl?: string;
  pathCoordinates?: [number, number][];
  currentPosition?: [number, number]; // 实时位置
}

type LayoutState = "collapsed" | "half" | "expanded";

// --- Mock Data ---

// A realistic path (Cross-city: Hangzhou -> Shanghai)
const MOCK_PATH: [number, number][] = [
  [120.153576, 30.287459], // Hangzhou (Start)
  [120.2, 30.3],
  [120.3, 30.4], // Highway entrance
  [120.5, 30.6], // Jiaxing area
  [120.8, 30.9],
  [121.1, 31.1], // Entering Shanghai
  [121.3, 31.2],
  [121.4737, 31.2304], // Shanghai (End)
];

const DEFAULT_TRUCK_ICON =
  "https://img.icons8.com/?size=100&id=BQjcRKZrKIEj&format=png&color=000000"; // Using a better car icon that supports rotation

// --- Component ---

export const DeliveryMap: React.FC<DeliveryMapProps> = ({
  riderIconUrl = DEFAULT_TRUCK_ICON,
  pathCoordinates = MOCK_PATH,
  currentPosition,
}) => {
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const [layoutState, setLayoutState] = useState<LayoutState>("half");
  const [isMapReady, setIsMapReady] = useState(false);

  // 1. Initialize Map
  useEffect(() => {
    // Security Configuration (Crucial for AMap JS API v2.0+)
    (window as any)._AMapSecurityConfig = {
      securityJsCode: AMAP_SECURITY_CODE,
    };

    AMapLoader.load({
      key: AMAP_KEY,
      version: "2.0",
      plugins: ["AMap.MoveAnimation", "AMap.Polyline", "AMap.Marker"],
    })
      .then((AMap) => {
        const map = new AMap.Map("delivery-map-container", {
          viewMode: "3D",
          zoom: 10, // Zoom out for cross-city
          center: pathCoordinates[0],
          mapStyle: "amap://styles/whitesmoke", // Clean style
          pitch: 30, // Slight 3D effect
        });

        mapRef.current = map;

        // Create Path (Polyline)
        const polyline = new AMap.Polyline({
          path: pathCoordinates,
          showDir: true,
          strokeColor: "#28F",
          strokeWeight: 6,
          strokeOpacity: 0.8,
          zIndex: 50, // Ensure line is below marker
          map: map, // Add directly to map
        });
        polylineRef.current = polyline;

        // Create Truck Marker
        const marker = new AMap.Marker({
          map: map,
          position: currentPosition || pathCoordinates[0],
          content: `
            <div style="transform: rotate(-90deg); display: flex; justify-content: center; align-items: center;">
              <img src="${riderIconUrl}" style="width: 32px; height: 32px; display: block;" />
            </div>
          `,
          offset: new AMap.Pixel(0, 0),
          anchor: "center",
          zIndex: 100, // Ensure marker is on top
          angle: 0, // Initial angle
        });
        markerRef.current = marker;

        // 移除自动动画，改为响应 currentPosition
        // marker.moveAlong(...)

        setIsMapReady(true);
      })
      .catch((e) => {
        console.error("AMap load failed", e);
      });

    return () => {
      if (mapRef.current) {
        mapRef.current.destroy();
      }
    };
  }, [riderIconUrl, pathCoordinates]); // 仅在初始化或路径/图标改变时重建

  // 2. Handle Real-time Position Updates
  useEffect(() => {
    if (markerRef.current && currentPosition) {
      // 使用 moveTo 平滑移动到新位置
      // 速度设为 1000km/h 模拟快速移动，或者根据实际距离计算
      // 这里使用 duration 模式可能更平滑，或者 speed
      markerRef.current.moveTo(currentPosition, {
        duration: 1000, // 1秒内移动到新位置
        autoRotation: true,
      });

      // 可选：如果需要地图跟随
      // mapRef.current.setCenter(currentPosition);
    }
  }, [currentPosition]);

  // 2. Handle Layout Changes & Map View Adjustment
  useEffect(() => {
    if (!mapRef.current || !isMapReady) return;

    // Calculate padding based on layout state to "center" the content in the visible area
    // We assume the map container is always full screen (behind the panel)
    // We use setFitView with padding to ensure the rider/path is visible in the "top" part.

    let bottomPadding = 0;
    const windowHeight = window.innerHeight; // Or container height

    switch (layoutState) {
      case "collapsed":
        bottomPadding = 100; // Panel is small
        break;
      case "half":
        bottomPadding = windowHeight * 0.5; // Panel covers 50%
        break;
      case "expanded":
        bottomPadding = windowHeight * 0.9; // Panel covers almost everything
        break;
    }

    // Adjust the view to fit the marker (car) within the visible area
    // We remove polylineRef.current from setFitView to focus on the car
    // [top, right, bottom, left]
    mapRef.current.setFitView(
      [markerRef.current],
      false,
      [50, 50, bottomPadding + 50, 50],
      10 // Max zoom level to avoid zooming in too close on a single point
    );
  }, [layoutState, isMapReady]);

  // --- UI Helpers ---

  const getPanelHeight = () => {
    switch (layoutState) {
      case "collapsed":
        return "120px";
      case "half":
        return "50%";
      case "expanded":
        return "90%";
    }
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100vh",
        overflow: "hidden",
        background: "#f0f0f0",
      }}
    >
      {/* Map Layer (Z-Index Low) */}
      <div
        id="delivery-map-container"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 1,
        }}
      />

      {/* Info Panel (Bottom Sheet, Z-Index High) */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          height: getPanelHeight(),
          backgroundColor: "white",
          borderTopLeftRadius: "16px",
          borderTopRightRadius: "16px",
          boxShadow: "0 -2px 10px rgba(0,0,0,0.1)",
          zIndex: 10,
          transition: "height 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)", // Smooth transition
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Drag Handle / Toggle Area */}
        <div
          style={{
            height: "24px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            cursor: "pointer",
          }}
          onClick={() => {
            // Simple toggle logic for demo
            if (layoutState === "collapsed") setLayoutState("half");
            else if (layoutState === "half") setLayoutState("expanded");
            else setLayoutState("collapsed");
          }}
        >
          <div
            style={{
              width: "40px",
              height: "4px",
              backgroundColor: "#ddd",
              borderRadius: "2px",
            }}
          />
        </div>

        {/* Panel Content */}
        <div
          style={{ padding: "0 24px 24px 24px", flex: 1, overflowY: "auto" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <Typography.Title level={4} style={{ margin: 0 }}>
              {layoutState === "expanded" ? "订单详情" : "运输中"}
            </Typography.Title>
            <Space>
              <Button
                size="small"
                icon={<DownOutlined />}
                onClick={() => setLayoutState("collapsed")}
                disabled={layoutState === "collapsed"}
              >
                收起
              </Button>
              <Button
                size="small"
                icon={<UpOutlined />}
                onClick={() => setLayoutState("expanded")}
                disabled={layoutState === "expanded"}
              >
                展开
              </Button>
            </Space>
          </div>

          <Card bordered={false} style={{ background: "#f9f9f9" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  padding: 8,
                  background: "#e6f7ff",
                  borderRadius: "50%",
                }}
              >
                <CarOutlined style={{ fontSize: 24, color: "#1890ff" }} />
              </div>
              <div>
                <Typography.Text strong style={{ fontSize: 16 }}>
                  您的包裹正在运输中
                </Typography.Text>
                <br />
                <Typography.Text type="secondary">预计明天送达</Typography.Text>
              </div>
            </div>
          </Card>

          {/* More content visible only in expanded/half mode */}
          <div style={{ marginTop: 24 }}>
            <Typography.Title level={5}>物流详情</Typography.Title>
            <div style={{ paddingLeft: 8, borderLeft: "2px solid #eee" }}>
              <div style={{ marginBottom: 16, position: "relative" }}>
                <div
                  style={{
                    position: "absolute",
                    left: -13,
                    top: 0,
                    width: 8,
                    height: 8,
                    background: "#1890ff",
                    borderRadius: "50%",
                  }}
                />
                <Typography.Text>商家已发货</Typography.Text>
                <br />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  14:30
                </Typography.Text>
              </div>
              <div style={{ marginBottom: 16, position: "relative" }}>
                <div
                  style={{
                    position: "absolute",
                    left: -13,
                    top: 0,
                    width: 8,
                    height: 8,
                    background: "#1890ff",
                    borderRadius: "50%",
                  }}
                />
                <Typography.Text>
                  离开 [杭州转运中心]，发往 [上海转运中心]
                </Typography.Text>
                <br />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  18:45
                </Typography.Text>
              </div>
              <div style={{ marginBottom: 16, position: "relative" }}>
                <div
                  style={{
                    position: "absolute",
                    left: -13,
                    top: 0,
                    width: 8,
                    height: 8,
                    background: "#52c41a",
                    borderRadius: "50%",
                  }}
                />
                <Typography.Text strong>运输中</Typography.Text>
                <br />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  当前
                </Typography.Text>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
