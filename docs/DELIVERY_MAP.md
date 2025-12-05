# DeliveryMap 物流轨迹组件使用文档

## 引入

该组件位于 `@repo/ui` 包中。

## API 接口 (Props)

| 属性名            | 类型                 | 必填 | 默认值               | 说明                                                                       |
| :---------------- | :------------------- | :--- | :------------------- | :------------------------------------------------------------------------- |
| `pathCoordinates` | `[number, number][]` | 否   | (Mock Data)          | 完整的配送路径坐标数组，用于绘制蓝色轨迹线。格式为 `[经度, 纬度]`。        |
| `currentPosition` | `[number, number]`   | 否   | `pathCoordinates[0]` | **核心属性**。车辆当前的实时坐标。当此属性变化时，车辆会平滑移动到新坐标。 |
| `riderIconUrl`    | `string`             | 否   | (Default Truck Icon) | 自定义车辆/骑手图标的 URL。                                                |

## 使用示例：模拟 WebSocket 实时更新

在实际业务中，你通常会通过 WebSocket 接收后端推送的最新位置信息。

```tsx
import { DeliveryMap } from "@repo/ui";
import { useEffect, useState } from "react";

const App = () => {
  // 1. 定义完整路径 (通常来自订单详情接口)
  const fullPath: [number, number][] = [
    [120.153576, 30.287459],
    [120.2, 30.3],
    // ... 更多坐标
  ];

  // 2. 管理当前位置状态
  const [currentPos, setCurrentPos] = useState<[number, number]>(fullPath[0]);

  // 3. 模拟 WebSocket 接收数据
  useEffect(() => {
    // 假设这是你的 WebSocket 连接
    const ws = new WebSocket("wss://your-api.com/tracking");

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // 假设后端返回格式: { lat: 30.123, lng: 120.123 }
      if (data.lat && data.lng) {
        // 更新状态，DeliveryMap 组件会自动处理平滑移动动画
        setCurrentPos([data.lng, data.lat]);
      }
    };

    return () => ws.close();
  }, []);

  return (
    <div style={{ height: "100vh", width: "100vw" }}>
      <DeliveryMap pathCoordinates={fullPath} currentPosition={currentPos} />
    </div>
  );
};
```
