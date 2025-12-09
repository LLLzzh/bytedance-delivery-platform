# Merchant 项目结构说明

## 📁 优化后的目录结构

```
apps/merchant/src/
├── App.tsx                 # 主应用组件，路由配置
├── main.tsx               # 应用入口
├── style.css              # 全局样式
├── vite-env.d.ts          # Vite 类型声明
│
├── components/            # 全局共享组件
│   └── RouteSelector/     # 路由选择器组件
│       └── index.tsx
│
├── pages/                 # 页面目录
│   ├── FenceConfig/       # 围栏配置页面
│   │   ├── index.tsx      # 主页面组件
│   │   ├── types.ts       # 类型定义
│   │   ├── constants.ts   # 常量定义（规则选项、门店位置等）
│   │   ├── components/    # 页面专用组件
│   │   │   ├── MapContainer.tsx    # 地图容器组件
│   │   │   └── OperationPanel.tsx   # 操作面板组件
│   │   └── hooks/         # 页面专用 hooks
│   │       └── useFenceEditor.ts    # 围栏编辑状态管理 hook
│   │
│   └── OrderDispatch/     # 订单发货管理页面
│       ├── index.tsx      # 导出文件
│       ├── OrderDispatchPage.tsx    # 订单发货页面
│       └── DispatchConfirmModal.tsx  # 发货确认弹窗
│
├── services/              # API 服务层
│   ├── index.ts          # 服务导出
│   ├── api-client.ts    # API 客户端
│   ├── fence.ts         # 围栏相关 API
│   └── order.ts         # 订单相关 API
│
└── utils/                # 工具函数
    └── shipping.ts       # 物流相关工具函数
```

## 🎯 优化要点

### 1. **页面目录结构优化**

- **FenceConfig**: 按功能模块组织，分离组件、hooks、类型和常量

  - `components/`: 页面专用组件（MapContainer, OperationPanel）
  - `hooks/`: 自定义 hooks（useFenceEditor）
  - `types.ts`: 类型定义
  - `constants.ts`: 常量定义（规则选项、门店位置等）

- **OrderDispatch**: 独立的订单发货管理模块
  - 将原本在 FenceConfig 下的订单相关页面移出
  - 保持模块的独立性和清晰性

### 2. **代码组织原则**

- **按功能模块划分**: 每个页面目录包含其所需的所有资源
- **关注点分离**: 组件、hooks、类型、常量分别管理
- **可复用性**: 全局组件放在 `components/`，页面专用组件放在页面目录下

### 3. **导入路径规范**

```typescript
// ✅ 好的实践
import { FenceData } from "./types";
import { ruleOptions } from "./constants";
import MapContainer from "./components/MapContainer";
import { useFenceEditor } from "./hooks/useFenceEditor";

// ❌ 避免
import { FenceData, ruleOptions } from "./types"; // 类型和常量混在一起
```

## 📝 后续优化建议

1. **类型定义统一管理**: 如果多个页面共享类型，可以考虑创建 `types/` 目录
2. **常量统一管理**: 全局常量可以放在 `constants/` 目录
3. **hooks 统一管理**: 如果 hooks 被多个页面使用，可以提升到 `hooks/` 目录
4. **组件库**: 如果组件被多个页面使用，可以提升到 `components/` 目录

## 🔄 迁移说明

所有导入路径已更新，确保：

- ✅ 组件导入路径正确
- ✅ hooks 导入路径正确
- ✅ 类型和常量导入路径正确
- ✅ 路由配置已更新
