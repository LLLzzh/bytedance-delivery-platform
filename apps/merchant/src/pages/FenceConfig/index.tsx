import { useState, useRef, useEffect } from "react";
import {
  Layout,
  Button,
  Space,
  message,
  Modal,
  List,
  Tag,
  Typography,
} from "antd";
import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import MapContainer, { MapContainerRef } from "./MapContainer";
import OperationPanel from "./OperationPanel";
import { FenceData, ruleOptions } from "./types";
import { fenceService } from "../../services/fence";

const { Sider, Content } = Layout;

// 商家门店位置常量，需要根据后端数据动态设置
const MERCHANT_LOCATION: [number, number] = [116.397428, 39.90923];

export default function FenceConfigPage() {
  const [drawingType, setDrawingType] = useState<"polygon" | "circle" | null>(
    null
  );
  const [currentFence, setCurrentFence] = useState<Partial<FenceData> | null>(
    null
  );
  const [panelVisible, setPanelVisible] = useState(false);
  const [fences, setFences] = useState<FenceData[]>([]);
  const mapRef = useRef<MapContainerRef>(null);

  // 加载围栏列表
  const loadFences = async () => {
    try {
      const data = await fenceService.getFences();
      setFences(data);
    } catch (error) {
      console.error("Failed to load fences:", error);
      message.error("加载围栏数据失败");
    }
  };

  useEffect(() => {
    loadFences();
  }, []);

  const handleDrawComplete = (data: Partial<FenceData>) => {
    setCurrentFence((prev) => ({ ...prev, ...data }));
    setPanelVisible(true);
  };

  const handleEditComplete = (data: Partial<FenceData>) => {
    setCurrentFence((prev) => ({ ...prev, ...data }));
  };

  const handleSave = async (values: FenceData) => {
    try {
      let savedFence: FenceData;
      if (values.id) {
        // 更新
        savedFence = await fenceService.updateFence(values);
        message.success("围栏更新成功");
      } else {
        // 新增
        savedFence = await fenceService.createFence(values);
        message.success("围栏创建成功");
      }

      // 确认地图操作（关闭编辑器等）
      mapRef.current?.confirmOperation(savedFence);

      // 更新本地状态
      setFences((prev) => {
        if (values.id) {
          return prev.map((f) => (f.id === values.id ? savedFence : f));
        } else {
          return [...prev, savedFence];
        }
      });

      // 重置状态
      setPanelVisible(false);
      setCurrentFence(null);
      setDrawingType(null);
    } catch (error) {
      console.error("Failed to save fence:", error);
      message.error("保存失败");
    }
  };

  const handleDelete = (id: string | number) => {
    Modal.confirm({
      title: "确认删除",
      content: "确定要删除这个围栏吗？",
      onOk: async () => {
        try {
          await fenceService.deleteFence(id);
          message.success("删除成功");

          // 取消当前的地图操作（如果有）
          mapRef.current?.cancelOperation();

          // 更新列表
          setFences((prev) => prev.filter((f) => f.id !== id));

          // 重置状态
          setPanelVisible(false);
          setCurrentFence(null);
          setDrawingType(null);
        } catch (error) {
          console.error("Failed to delete fence:", error);
          message.error("删除失败");
        }
      },
    });
  };

  const handleCancel = () => {
    mapRef.current?.cancelOperation();
    setPanelVisible(false);
    setCurrentFence(null);
    setDrawingType(null);
  };

  const handleSelectFence = (data: FenceData) => {
    setCurrentFence(data);
    setPanelVisible(true);
    setDrawingType(null);
    // 激活地图上的编辑状态
    mapRef.current?.startEdit(data);
  };

  return (
    <Layout style={{ height: "100%" }}>
      <Content style={{ position: "relative" }}>
        <MapContainer
          ref={mapRef}
          drawingType={drawingType}
          setDrawingType={setDrawingType}
          onDrawComplete={handleDrawComplete}
          onEditComplete={handleEditComplete}
          center={MERCHANT_LOCATION}
          existingFences={fences}
          onSelectFence={handleSelectFence}
        />
      </Content>

      <Sider
        width={400}
        theme="light"
        style={{
          borderLeft: "1px solid #f0f0f0",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: 24,
            borderBottom: "1px solid #f0f0f0",
            background: "#fff",
          }}
        >
          <Space direction="vertical" style={{ width: "100%" }}>
            <div style={{ fontSize: 16, fontWeight: "bold" }}>配送范围配置</div>
            <div style={{ color: "#666" }}>当前门店：测试位置</div>
            <Space style={{ marginTop: 8 }}>
              <Button
                type={drawingType === "circle" ? "primary" : "default"}
                onClick={() => {
                  setDrawingType("circle");
                  message.info("请在地图上按住鼠标左键拖拽绘制圆形");
                }}
              >
                添加圆形
              </Button>
              <Button
                type={drawingType === "polygon" ? "primary" : "default"}
                onClick={() => {
                  setDrawingType("polygon");
                  message.info("请在地图上点击绘制多边形节点，双击结束绘制");
                }}
              >
                添加多边形
              </Button>
            </Space>
          </Space>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {panelVisible ? (
            <OperationPanel
              visible={panelVisible}
              data={currentFence || {}}
              onSave={handleSave}
              onCancel={handleCancel}
              onDelete={handleDelete}
            />
          ) : (
            <div style={{ padding: 24 }}>
              <div style={{ marginBottom: 16, fontWeight: "bold" }}>
                围栏列表 ({fences.length})
              </div>
              <List
                dataSource={fences}
                renderItem={(item) => {
                  const rule = ruleOptions.find((r) => r.id === item.rule_id);
                  return (
                    <List.Item
                      actions={[
                        <Button
                          type="text"
                          icon={<EditOutlined />}
                          onClick={() => handleSelectFence(item)}
                        />,
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => handleDelete(item.id!)}
                        />,
                      ]}
                      style={{
                        background: "#fafafa",
                        marginBottom: 8,
                        padding: 12,
                        borderRadius: 6,
                        border: "1px solid #f0f0f0",
                      }}
                    >
                      <List.Item.Meta
                        title={
                          <div style={{ textAlign: "left" }}>
                            <Space>
                              <span>{item.fence_name}</span>
                              {rule && (
                                <Tag
                                  color={rule.color}
                                  style={{ marginRight: 0 }}
                                >
                                  {rule.name}
                                </Tag>
                              )}
                            </Space>
                          </div>
                        }
                        description={
                          <Typography.Text
                            type="secondary"
                            ellipsis
                            style={{
                              maxWidth: 200,
                              textAlign: "left",
                              display: "block",
                            }}
                          >
                            {item.fence_desc || "暂无描述"}
                          </Typography.Text>
                        }
                      />
                    </List.Item>
                  );
                }}
              />
              {fences.length === 0 && (
                <div
                  style={{ textAlign: "center", color: "#999", marginTop: 32 }}
                >
                  暂无围栏，请在地图上绘制
                </div>
              )}
            </div>
          )}
        </div>
      </Sider>
    </Layout>
  );
}
