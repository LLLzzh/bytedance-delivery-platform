/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useState,
} from "react";
import AMapLoader from "@amap/amap-jsapi-loader";
import { message } from "antd";
import { FenceData, ruleOptions } from "./types";

//接口样式说明：
// 样式配置--编辑中
const STYLE_EDITING = {
  strokeColor: "#FA541C",
  strokeOpacity: 1,
  strokeWeight: 2,
  fillColor: "#FA541C",
  fillOpacity: 0.2,
  strokeStyle: "dashed",
  strokeDasharray: [10, 10],
};
// 根据 rule_id 获取样式配置
const getStyleByRuleId = (ruleId: number | null) => {
  const rule = ruleOptions.find((r) => r.id === ruleId);
  const color = rule ? rule.color : "#1677ff"; // Default blue
  return {
    strokeColor: color,
    strokeOpacity: 1,
    strokeWeight: 2,
    fillColor: color,
    fillOpacity: 0.2,
    strokeStyle: "solid",
    strokeDasharray: [0, 0],
  };
};

export interface MapContainerRef {
  cancelOperation: () => void;
  confirmOperation: (data?: FenceData) => void;
  startEdit: (fence: FenceData) => void;
}
// 地图容器组件 Props
interface MapContainerProps {
  drawingType: "polygon" | "circle" | null;
  onDrawComplete: (data: Partial<FenceData>) => void;
  onEditComplete: (data: Partial<FenceData>) => void;
  setDrawingType: (type: "polygon" | "circle" | null) => void;
  center?: [number, number];
  existingFences?: FenceData[];
  onSelectFence?: (data: FenceData) => void;
}

/*----------------------*/
// 地图容器组件，forwardRef 用于暴露方法给父组件
const MapContainer = forwardRef<MapContainerRef, MapContainerProps>(
  (
    {
      drawingType,
      onDrawComplete,
      onEditComplete,
      setDrawingType,
      center = [116.397428, 39.90923], // 默认中心点为北京
      existingFences = [],
      onSelectFence,
    },
    ref
  ) => {
    const mapRef = useRef<any>(null); // 存储地图实例
    const mouseToolRef = useRef<any>(null);
    const editorRef = useRef<any>(null);
    const currentOverlayRef = useRef<any>(null);
    const amapRef = useRef<any>(null); // 存储 AMap 对象引用
    const overlaysRef = useRef<any[]>([]); // 存储已保存的覆盖物列表
    const [isMapReady, setIsMapReady] = useState(false);

    // 更新或创建围栏标签
    const updateOverlayLabel = (overlay: any, data: Partial<FenceData>) => {
      const AMap = amapRef.current;
      if (!AMap || !mapRef.current) return;

      const rule = ruleOptions.find((r) => r.id === data.rule_id);
      const ruleText = rule ? `${rule.name} ${rule.logic}` : "未配置规则";
      const content = `
      <div style="
        padding: 4px 8px; 
        background: rgba(255, 255, 255, 0.9); 
        border: 1px solid #1677ff; 
        border-radius: 4px; 
        font-size: 12px; 
        color: #333; 
        text-align: center;
        box-shadow: 0 2px 6px rgba(0,0,0,0.1);
      ">
        <div style="font-weight: bold; margin-bottom: 2px;">${data.fence_name || "未命名围栏"}</div>
        <div style="color: #666; font-size: 10px;">${ruleText}</div>
      </div>
    `;

      let position;
      // 优先使用 data.shape_type 判断，否则使用特征检测
      let isPolygon = false;
      if (data.shape_type) {
        isPolygon = data.shape_type === "polygon";
      } else {
        // 兼容 AMap 2.0 的类名检查方式，或者直接检查方法
        isPolygon =
          overlay.CLASS_NAME === "AMap.Polygon" ||
          (overlay.getPath && !overlay.getRadius);
      }

      if (isPolygon) {
        // 对于多边形，尝试获取中心点，如果不行则取第一个点
        try {
          position = overlay.getBounds().getCenter();
        } catch (e) {
          const path = overlay.getPath();
          if (path && path.length > 0) position = path[0];
        }
      } else {
        position = overlay.getCenter();
      }

      if (!position) return;

      const extData = overlay.getExtData() || {};
      let text = extData._label;

      if (text) {
        text.setText(content);
        text.setPosition(position);
      } else {
        text = new AMap.Text({
          text: content,
          anchor: "center",
          position: position,
          offset: new AMap.Pixel(0, 0),
          style: { "background-color": "transparent", border: "none" }, // 使用自定义 HTML 样式
          bubble: true, // 允许事件冒泡，这样双击标签也能触发地图/围栏事件
          zIndex: 100,
        });
        text.setMap(mapRef.current);

        // 绑定双击事件到 Label 上，以触发编辑
        text.on("dblclick", () => {
          handleOverlayEdit(overlay);
        });

        overlay.setExtData({ ...extData, _label: text });
      }
    };
    // 暴露给父组件的方法--取消当前操作、确认当前操作、开始编辑指定围栏
    useImperativeHandle(ref, () => ({
      cancelOperation: () => {
        const targetOverlay = currentOverlayRef.current;
        // 移除当前正在绘制/编辑的覆盖物
        if (targetOverlay) {
          const isSaved = overlaysRef.current.includes(targetOverlay);

          // 先关闭编辑器
          if (editorRef.current) {
            editorRef.current.close();
            editorRef.current = null;
          }

          if (!isSaved) {
            // 移除 Label
            const label = targetOverlay.getExtData()._label;
            if (label) label.remove();

            mapRef.current?.remove(targetOverlay);
          } else {
            // 恢复样式
            // 使用 setTimeout 避开 PolyEditor 关闭时的样式恢复机制
            const extData = targetOverlay.getExtData();
            setTimeout(() => {
              targetOverlay.setOptions(getStyleByRuleId(extData.rule_id));
            }, 50);
          }
          currentOverlayRef.current = null;
        }

        if (mouseToolRef.current) {
          mouseToolRef.current.close();
        }
      },
      confirmOperation: () => {
        const targetOverlay = currentOverlayRef.current;
        if (targetOverlay) {
          // 1. 关闭编辑器
          if (editorRef.current) {
            editorRef.current.close();
            editorRef.current = null;
          }

          // 2. 移除临时覆盖物及其 Label
          // 我们完全依赖 useEffect 根据 existingFences 来重新绘制
          // 所以这里直接把刚才画的这个临时的清理掉即可，避免与 useEffect 冲突
          const extData = targetOverlay.getExtData();
          if (extData && extData._label) {
            extData._label.remove();
          }
          mapRef.current?.remove(targetOverlay);

          currentOverlayRef.current = null;
        }
      },
      startEdit: (fence: FenceData) => {
        if (!fence || !fence.id) return;
        const targetOverlay = overlaysRef.current.find((o) => {
          const ext = o.getExtData();
          return ext && ext.id === fence.id;
        });

        if (targetOverlay) {
          // 复用 handleOverlayEdit 的前得部分逻辑，但不触发 onSelectFence
          if (mouseToolRef.current && (mouseToolRef.current as any)._enabled)
            return;

          // 如果已经在编辑其他的，先关闭之前的
          if (editorRef.current) {
            editorRef.current.close();
            editorRef.current = null;
            // 恢复上一个正在编辑的样式（如果有）
            if (
              currentOverlayRef.current &&
              currentOverlayRef.current !== targetOverlay
            ) {
              const prevExtData = currentOverlayRef.current.getExtData();
              currentOverlayRef.current.setOptions(
                getStyleByRuleId(prevExtData.rule_id)
              );
            }
          }

          currentOverlayRef.current = targetOverlay;
          targetOverlay.setOptions(STYLE_EDITING);

          // 启动编辑
          startEditor(targetOverlay);
        }
      },
    }));
    // 处理覆盖物被编辑的逻辑
    const handleOverlayEdit = (overlay: any) => {
      if (mouseToolRef.current && (mouseToolRef.current as any)._enabled)
        return;

      // 如果已经在编辑其他的，先关闭之前的
      if (editorRef.current) {
        editorRef.current.close();
        editorRef.current = null;
        // 恢复上一个正在编辑的样式（如果有）
        if (
          currentOverlayRef.current &&
          currentOverlayRef.current !== overlay
        ) {
          const prevExtData = currentOverlayRef.current.getExtData();
          currentOverlayRef.current.setOptions(
            getStyleByRuleId(prevExtData.rule_id)
          );
        }
      }

      currentOverlayRef.current = overlay;
      overlay.setOptions(STYLE_EDITING);

      // 启动编辑
      startEditor(overlay);

      // 通知父组件
      const extData = overlay.getExtData();
      // 构造当前图形的数据
      const currentData: Partial<FenceData> = { ...extData };
      // 移除内部使用的 _label 引用，避免传递给业务层
      delete (currentData as any)._label;

      // 增强类型判断
      const isPolygon =
        overlay.CLASS_NAME === "AMap.Polygon" ||
        (overlay.getPath && !overlay.getRadius);
      const isCircle =
        overlay.CLASS_NAME === "AMap.Circle" ||
        (overlay.getRadius && overlay.getCenter);

      if (isPolygon) {
        const path = overlay.getPath();
        if (path && Array.isArray(path)) {
          currentData.coordinates = path.map((p: any) => [p.lng, p.lat]);
        }
        currentData.shape_type = "polygon";
      } else if (isCircle) {
        currentData.coordinates = [
          [overlay.getCenter().lng, overlay.getCenter().lat],
        ];
        currentData.radius = overlay.getRadius();
        currentData.shape_type = "circle";
      }

      if (onSelectFence) {
        onSelectFence(currentData as FenceData);
      }
    };
    // 双击触发编辑绑定
    const bindEditEvent = (overlay: any) => {
      // 改为双击触发编辑
      overlay.on("dblclick", () => {
        handleOverlayEdit(overlay);
      });
    };
    // 启动编辑器
    const startEditor = (overlay: any) => {
      if (editorRef.current) {
        editorRef.current.close();
      }
      const AMap = amapRef.current;
      if (!AMap) return;

      if (overlay.CLASS_NAME === "AMap.Polygon") {
        const polyEditor = new AMap.PolyEditor(mapRef.current, overlay);
        polyEditor.open();
        polyEditor.on("end", (event: any) => {
          const newPath = event.target.getPath();
          const newCoords = newPath.map((p: any) => [p.lng, p.lat]);
          onEditComplete({ coordinates: newCoords });
          // 编辑结束（如调整形状）时，也更新 Label 位置
          const extData = overlay.getExtData();
          updateOverlayLabel(overlay, extData);
        });
        // 监听 adjust 事件，实时更新 Label 位置（可选，如果性能允许）
        polyEditor.on("adjust", () => {
          const extData = overlay.getExtData();
          updateOverlayLabel(overlay, extData);
        });
        editorRef.current = polyEditor;
      } else if (overlay.CLASS_NAME === "AMap.Circle") {
        const circleEditor = new AMap.CircleEditor(mapRef.current, overlay);
        circleEditor.open();
        circleEditor.on("end", (event: any) => {
          const newCenter = event.target.getCenter();
          const newRadius = event.target.getRadius();
          onEditComplete({
            coordinates: [[newCenter.lng, newCenter.lat]],
            radius: newRadius,
          });
          const extData = overlay.getExtData();
          updateOverlayLabel(overlay, extData);
        });
        circleEditor.on("move", () => {
          const extData = overlay.getExtData();
          updateOverlayLabel(overlay, extData);
        });
        editorRef.current = circleEditor;
      }
    };

    // 初始化地图
    useEffect(() => {
      // 屏蔽 Canvas 性能警告 (Monkey Patch)
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      HTMLCanvasElement.prototype.getContext = function (
        type: string,
        attributes?: any
      ) {
        if (type === "2d") {
          attributes = { ...attributes, willReadFrequently: true };
        }
        return originalGetContext.call(this, type, attributes);
      };

      // 设置安全密钥
      (window as any)._AMapSecurityConfig = {
        securityJsCode: "60c4d15e036338526ec65a75e15ce16c",
      };

      AMapLoader.load({
        key: "b7a7a32ea42751cfdd896cc742d2cd08",
        version: "2.0",
        plugins: [
          "AMap.MouseTool",
          "AMap.PolyEditor",
          "AMap.CircleEditor",
          "AMap.Marker",
          "AMap.Text",
        ],
      })
        .then((AMap) => {
          amapRef.current = AMap;
          const map = new AMap.Map("map-container", {
            zoom: 14,
            center: center,
            resizeEnable: true,
            doubleClickZoom: false, // 禁止双击放大，避免与双击编辑冲突
          });
          mapRef.current = map;
          setIsMapReady(true);

          // Add Merchant Marker
          const marker = new AMap.Marker({
            position: center,
            title: "商家门店",
            label: {
              content:
                '<div style="padding: 4px 8px; background: #1677ff; color: white; border-radius: 4px;">商家地址</div>',
              direction: "top",
            },
          });
          map.add(marker);

          const mouseTool = new AMap.MouseTool(map);
          mouseToolRef.current = mouseTool;

          mouseTool.on("draw", (e: any) => {
            const overlay = e.obj;
            currentOverlayRef.current = overlay;

            // 设置为编辑样式
            overlay.setOptions(STYLE_EDITING);

            // Stop drawing
            mouseTool.close();
            setDrawingType(null);

            let coordinates: number[][] = [];
            let radius = 0;
            let shape_type: "polygon" | "circle" = "polygon";

            // 增强类型判断，别改，不知道为啥得这样判断
            const isPolygon =
              overlay.CLASS_NAME === "AMap.Polygon" ||
              (overlay.getPath && !overlay.getRadius);
            const isCircle =
              overlay.CLASS_NAME === "AMap.Circle" ||
              (overlay.getRadius && overlay.getCenter);

            if (isPolygon) {
              const path = overlay.getPath();
              if (path && Array.isArray(path)) {
                coordinates = path.map((p: any) => [p.lng, p.lat]);
              }
              shape_type = "polygon";
            } else if (isCircle) {
              const center = overlay.getCenter();
              coordinates = [[center.lng, center.lat]];
              radius = overlay.getRadius();
              shape_type = "circle";
            }

            // 立即开启编辑
            startEditor(overlay);

            // 绑定点击事件，确保新建的围栏在编辑器关闭后也能被再次点击编辑
            bindEditEvent(overlay);
            onDrawComplete({
              shape_type,
              coordinates,
              radius,
            });
          });
        })
        .catch((e) => {
          console.error(e);
          message.error("地图加载失败");
        });

      return () => {
        if (mapRef.current) {
          mapRef.current.destroy();
        }
      };
    }, []); // 只在挂载时执行一次

    // 监听 drawingType 变化，启动绘制工具（点击绘制圆形或多边形按钮时触发）
    useEffect(() => {
      if (!mapRef.current || !mouseToolRef.current) return;

      if (drawingType === "polygon") {
        // 如果有正在编辑的，先取消？或者由父组件控制
        mouseToolRef.current.polygon(STYLE_EDITING);
        mapRef.current.setDefaultCursor("crosshair");
      } else if (drawingType === "circle") {
        mouseToolRef.current.circle(STYLE_EDITING);
        mapRef.current.setDefaultCursor("crosshair");
      } else {
        mouseToolRef.current.close();
        mapRef.current.setDefaultCursor("default");
      }
    }, [drawingType]);

    // 监听 existingFences 变化，渲染围栏【这块性能不太好，后续可以优化】
    useEffect(() => {
      if (!isMapReady || !mapRef.current || !amapRef.current) return;
      const map = mapRef.current;
      const AMap = amapRef.current;

      // 清除现有围栏
      overlaysRef.current.forEach((overlay) => {
        const extData = overlay.getExtData();
        if (extData && extData._label) {
          extData._label.remove();
        }
        map.remove(overlay);
      });
      overlaysRef.current = [];

      // 重新渲染
      console.log("Re-rendering fences:", existingFences);
      if (existingFences && existingFences.length > 0) {
        existingFences.forEach((fence) => {
          let overlay: any;
          try {
            if (fence.shape_type === "polygon") {
              overlay = new AMap.Polygon({
                path: fence.coordinates,
                ...getStyleByRuleId(fence.rule_id),
                extData: fence,
              });
            } else {
              overlay = new AMap.Circle({
                center: fence.coordinates[0],
                radius: fence.radius,
                ...getStyleByRuleId(fence.rule_id),
                extData: fence,
              });
            }
            map.add(overlay);
            overlaysRef.current.push(overlay);
            bindEditEvent(overlay);

            // 延迟一点更新 Label，确保 overlay 已经渲染
            setTimeout(() => {
              updateOverlayLabel(overlay, fence);
            }, 0);
          } catch (e) {
            console.error("Error rendering fence:", fence, e);
          }
        });
      }
    }, [existingFences, isMapReady]);

    return <div id="map-container" style={{ width: "100%", height: "100%" }} />;
  }
);

export default MapContainer;
