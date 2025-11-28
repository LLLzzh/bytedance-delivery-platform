import React, { useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  useLocation,
  Outlet,
  Navigate,
} from "react-router-dom";
import { Layout, Menu, theme, Typography, Button, Card } from "antd";
import {
  DashboardOutlined,
  CarOutlined,
  EnvironmentOutlined,
  RocketOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import FenceConfigPage from "./pages/FenceConfig";
import RouteSelector from "./components/RouteSelector";

const { Header, Content, Sider } = Layout;

// --- 1. Page Components ---

// A. Order Dispatch Page
// 这个页面之后要写订单列表，现在暂时只放了发货按钮，只是想看下地图的效果，之后请根据地图组件调整布局
const OrderDispatchPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Card
        title="订单发货管理"
        style={{
          width: 400,
          textAlign: "center",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        }}
      >
        <p style={{ marginBottom: 24, color: "#666" }}>
          点击下方按钮开始模拟发货流程
        </p>
        <Button
          type="primary"
          size="large"
          icon={<RocketOutlined />}
          onClick={() => setIsModalOpen(true)}
          style={{ width: "100%" }}
        >
          立即发货
        </Button>
      </Card>

      <RouteSelector
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={(route) => {
          console.log("Selected route:", route);
          setIsModalOpen(false);
        }}
        startLngLat={[116.397428, 39.90923]}
        endLngLat={[116.497428, 39.91923]}
      />
    </div>
  );
};

// B. Delivery Zone Page (Wrapper for FenceConfig)
const DeliveryZonePage: React.FC = () => {
  return (
    <div style={{ height: "100%", position: "relative" }}>
      <FenceConfigPage />
    </div>
  );
};

// C. Dashboard Page
const DashboardPage: React.FC = () => {
  return (
    <div
      style={{
        height: "100%",
        padding: 24,
        background: "#001529",
        color: "white",
        borderRadius: 8,
      }}
    >
      <div
        style={{
          height: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          border: "1px dashed rgba(255,255,255,0.3)",
          borderRadius: 8,
          flexDirection: "column",
        }}
      >
        <DashboardOutlined
          style={{ fontSize: 64, marginBottom: 24, opacity: 0.5 }}
        />
        <Typography.Title level={2} style={{ color: "white", margin: 0 }}>
          物流可视化大屏
        </Typography.Title>
        <Typography.Text
          style={{ color: "rgba(255,255,255,0.6)", marginTop: 8 }}
        >
          &lt;BigScreenMapPlaceholder /&gt; 预留位置
        </Typography.Text>
      </div>
    </div>
  );
};

// --- 2. Layout Component ---

const AppLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  // Map paths to menu keys
  const getSelectedKey = () => {
    const path = location.pathname;
    if (path.startsWith("/DeliveryDispatch")) return "dispatch";
    if (path.startsWith("/FenceConfig")) return "fence";
    if (path.startsWith("/dashboard")) return "dashboard";
    return "";
  };

  const items: MenuProps["items"] = [
    {
      key: "dashboard",
      icon: <DashboardOutlined />,
      label: "物流可视化大屏",
      onClick: () => navigate("/dashboard"),
    },
    {
      key: "logistics",
      icon: <CarOutlined />,
      label: "物流管理",
      children: [
        {
          key: "dispatch",
          label: "订单发货管理",
          icon: <RocketOutlined />,
          onClick: () => navigate("/DeliveryDispatch"),
        },
        {
          key: "fence",
          label: "配送区域配置",
          icon: <EnvironmentOutlined />,
          onClick: () => navigate("/FenceConfig"),
        },
      ],
    },
  ];

  const getTitle = () => {
    const key = getSelectedKey();
    switch (key) {
      case "dashboard":
        return "物流可视化大屏";
      case "dispatch":
        return "订单发货管理";
      case "fence":
        return "配送区域配置";
      default:
        return "商家端管理系统";
    }
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={(value) => setCollapsed(value)}
      >
        <div
          style={{
            height: 32,
            margin: 16,
            background: "rgba(255, 255, 255, 0.2)",
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontWeight: "bold",
            overflow: "hidden",
            whiteSpace: "nowrap",
          }}
        >
          {collapsed ? "商家" : "商家端管理系统"}
        </div>
        <Menu
          theme="dark"
          selectedKeys={[getSelectedKey()]}
          defaultOpenKeys={["logistics"]}
          mode="inline"
          items={items}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: 0,
            background: colorBgContainer,
            display: "flex",
            alignItems: "center",
            paddingLeft: 24,
          }}
        >
          <Typography.Title level={4} style={{ margin: 0 }}>
            {getTitle()}
          </Typography.Title>
        </Header>
        <Content style={{ margin: "16px" }}>
          <div
            style={{
              padding: 0,
              height: "100%",
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
              overflow: "hidden",
            }}
          >
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

// --- 3. Main App Component ---

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="DeliveryDispatch" element={<OrderDispatchPage />} />
          <Route path="FenceConfig" element={<DeliveryZonePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
