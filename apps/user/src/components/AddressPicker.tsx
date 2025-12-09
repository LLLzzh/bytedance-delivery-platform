/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState } from "react";
import { Spin, message } from "antd";
import AMapLoader from "@amap/amap-jsapi-loader";

const AMAP_KEY = "b7a7a32ea42751cfdd896cc742d2cd08";
const AMAP_SECURITY_CODE = "60c4d15e036338526ec65a75e15ce16c";

export interface AddressPickerProps {
  /**
   * 地图容器高度
   */
  height?: string | number;
  /**
   * 默认中心点坐标 [经度, 纬度]
   */
  defaultCenter?: [number, number];
  /**
   * 选择位置后的回调
   */
  onSelect?: (data: { coords: [number, number]; address: string }) => void;
  /**
   * 初始选中的位置
   */
  initialPosition?: {
    coords: [number, number];
    address?: string;
  };
}

/**
 * 地址选择器组件 - 通过地图选点
 */
export const AddressPicker: React.FC<AddressPickerProps> = ({
  height = 400,
  defaultCenter = [120.153576, 30.287459], // 默认杭州
  onSelect,
  initialPosition,
}) => {
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [mapContainerId] = useState(
    () => `address-picker-${Math.random().toString(36).substr(2, 9)}`
  );

  // 初始化地图
  useEffect(() => {
    // 设置安全密钥
    (window as any)._AMapSecurityConfig = {
      securityJsCode: AMAP_SECURITY_CODE,
    };

    let isMounted = true;

    AMapLoader.load({
      key: AMAP_KEY,
      version: "2.0",
      plugins: [
        "AMap.Geocoder",
        "AMap.Marker",
        "AMap.AutoComplete",
        "AMap.PlaceSearch",
      ],
    })
      .then((AMap) => {
        if (!isMounted) return;

        const container = document.getElementById(mapContainerId);
        if (!container) {
          console.error("Map container not found");
          return;
        }

        // 创建地图实例
        const center = initialPosition?.coords || defaultCenter;
        const map = new AMap.Map(mapContainerId, {
          zoom: 15,
          center: center,
          mapStyle: "amap://styles/whitesmoke",
        });

        mapRef.current = map;

        // 创建地理编码服务
        const geocoder = new AMap.Geocoder({
          city: "全国", // 城市设为全国，自动判断
        });
        geocoderRef.current = geocoder;

        // 创建标记
        const marker = new AMap.Marker({
          map: map,
          position: center,
          draggable: true, // 允许拖拽
          cursor: "move",
          icon: new AMap.Icon({
            size: new AMap.Size(32, 32),
            image: "https://webapi.amap.com/theme/v1.3/markers/n/mark_r.png",
            imageOffset: new AMap.Pixel(0, 0),
            imageSize: new AMap.Size(32, 32),
          }),
        });
        markerRef.current = marker;

        // 如果有初始位置，获取地址
        if (initialPosition?.coords) {
          geocodePosition(
            AMap,
            initialPosition.coords,
            initialPosition.address
          );
        }

        // 地图点击事件
        map.on("click", (e: any) => {
          const lnglat = [e.lnglat.lng, e.lnglat.lat] as [number, number];
          marker.setPosition(lnglat);
          geocodePosition(AMap, lnglat);
        });

        // 标记拖拽结束事件
        marker.on("dragend", (e: any) => {
          const lnglat = [e.lnglat.lng, e.lnglat.lat] as [number, number];
          geocodePosition(AMap, lnglat);
        });

        setIsMapReady(true);
      })
      .catch((e) => {
        console.error("AMap load failed", e);
        message.error("地图加载失败，请刷新页面重试");
      });

    return () => {
      isMounted = false;
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
      if (markerRef.current) {
        markerRef.current = null;
      }
      if (geocoderRef.current) {
        geocoderRef.current = null;
      }
    };
  }, [mapContainerId, defaultCenter, initialPosition]);

  // 地理编码：将坐标转换为地址
  const geocodePosition = async (
    AMap: any,
    coords: [number, number],
    cachedAddress?: string
  ) => {
    if (cachedAddress) {
      // 如果有缓存的地址，直接使用
      onSelect?.({
        coords,
        address: cachedAddress,
      });
      return;
    }

    setIsGeocoding(true);
    try {
      geocoderRef.current.getAddress(coords, (status: string, result: any) => {
        setIsGeocoding(false);
        if (status === "complete" && result.info === "OK") {
          const address =
            result.regeocode.formattedAddress || result.regeocode.address;
          onSelect?.({
            coords,
            address,
          });
        } else {
          message.warning("无法获取地址信息，请手动输入地址");
          onSelect?.({
            coords,
            address: "",
          });
        }
      });
    } catch (error) {
      setIsGeocoding(false);
      console.error("Geocoding failed:", error);
      message.warning("地址解析失败，请手动输入地址");
      onSelect?.({
        coords,
        address: "",
      });
    }
  };

  // 监听容器大小变化
  useEffect(() => {
    if (!isMapReady || !containerRef.current || !mapRef.current) return;

    const container = containerRef.current;
    const map = mapRef.current;

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        if (map && !map.destroyed) {
          map.getSize();
          map.resize();
        }
      });
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [isMapReady]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: typeof height === "number" ? `${height}px` : height,
        border: "1px solid #d9d9d9",
        borderRadius: "4px",
        overflow: "hidden",
        background: "#f0f0f0",
      }}
    >
      <div
        id={mapContainerId}
        style={{
          width: "100%",
          height: "100%",
        }}
      />
      {isGeocoding && (
        <div
          style={{
            position: "absolute",
            top: "10px",
            left: "10px",
            background: "rgba(255, 255, 255, 0.9)",
            padding: "8px 12px",
            borderRadius: "4px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            zIndex: 10,
          }}
        >
          <Spin size="small" style={{ marginRight: 8 }} />
          <span style={{ fontSize: 12 }}>正在获取地址...</span>
        </div>
      )}
      <div
        style={{
          position: "absolute",
          bottom: "10px",
          left: "10px",
          background: "rgba(255, 255, 255, 0.9)",
          padding: "8px 12px",
          borderRadius: "4px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          fontSize: 12,
          color: "#666",
          zIndex: 10,
        }}
      >
        提示：点击地图或拖拽标记选择收货地址
      </div>
    </div>
  );
};
