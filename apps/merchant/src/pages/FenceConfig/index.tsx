import { useState, useRef, useEffect } from "react";
import {
  Layout,
  Button,
  Space,
  message,
  Modal,
  Tag,
  Typography,
  Card,
} from "antd";
import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import MapContainer, { MapContainerRef } from "./components/MapContainer";
import OperationPanel from "./components/OperationPanel";
import { FenceData } from "./types";
import { ruleOptions, MERCHANT_LOCATION } from "./constants";
import { fenceService } from "../../services/fence";
import { useFenceEditor } from "./hooks/useFenceEditor";

const { Sider, Content } = Layout;

export default function FenceConfigPage() {
  const [drawingType, setDrawingType] = useState<"polygon" | "circle" | null>(
    null
  );
  const [fences, setFences] = useState<FenceData[]>([]);
  const mapRef = useRef<MapContainerRef>(null);

  // 使用 custom hook 管理围栏编辑状态
  const {
    currentFence,
    panelVisible,
    startEdit: editorStartEdit,
    onDrawComplete: editorOnDrawComplete,
    onEditComplete: editorOnEditComplete,
    cancelEdit: editorCancelEdit,
    getLatestFenceData,
    onSaveComplete: editorOnSaveComplete,
  } = useFenceEditor(mapRef);

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
    editorOnDrawComplete(data);
  };

  const handleEditComplete = (data: Partial<FenceData>) => {
    editorOnEditComplete(data);
  };

  const handleSave = async (formValues: FenceData) => {
    try {
      // 使用 hook 中的方法获取最新数据（优先从覆盖物获取）
      const finalData = getLatestFenceData(formValues);

      let savedFence: FenceData;
      if (finalData.id) {
        // 更新
        const { id, ...dataWithoutId } = finalData;
        savedFence = await fenceService.updateFence(id, dataWithoutId);
        message.success("围栏更新成功");
      } else {
        // 新增
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, ...dataWithoutId } = finalData;
        savedFence = await fenceService.createFence(dataWithoutId);
        message.success("围栏创建成功");
      }

      // 更新本地状态（先更新状态，让 useEffect 重新渲染）
      setFences((prev) => {
        if (finalData.id) {
          return prev.map((f) => (f.id === finalData.id ? savedFence : f));
        } else {
          return [...prev, savedFence];
        }
      });

      // 确认地图操作（关闭编辑器等）
      // 使用 savedFence，它包含后端返回的最新数据
      // 延迟一点调用，确保状态更新完成
      setTimeout(() => {
        mapRef.current?.confirmOperation(savedFence);
      }, 0);

      // 重置状态
      editorOnSaveComplete();
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
          editorCancelEdit();
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
    editorCancelEdit();
    setDrawingType(null);
  };

  const handleSelectFence = (data: FenceData) => {
    editorStartEdit(data);
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
          <Space orientation="vertical" style={{ width: "100%" }}>
            <div style={{ fontSize: 16, fontWeight: "bold" }}>配送范围配置</div>
            <div style={{ color: "#666" }}>当前门店：测试位置</div>
            <Space style={{ marginTop: 8 }}>
              <Button
                type={drawingType === "circle" ? "primary" : "default"}
                onClick={() => {
                  // 开始绘制新围栏时，清空当前围栏数据和面板
                  editorCancelEdit();
                  setDrawingType("circle");
                  message.info("请在地图上按住鼠标左键拖拽绘制圆形");
                }}
              >
                添加圆形
              </Button>
              <Button
                type={drawingType === "polygon" ? "primary" : "default"}
                onClick={() => {
                  // 开始绘制新围栏时，清空当前围栏数据和面板
                  editorCancelEdit();
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
              <div>
                {fences.map((item) => {
                  const rule = ruleOptions.find((r) => r.id === item.rule_id);
                  return (
                    <Card
                      key={item.id}
                      size="small"
                      style={{
                        background: "#fafafa",
                        marginBottom: 8,
                        borderRadius: 6,
                        border: "1px solid #f0f0f0",
                      }}
                      actions={[
                        <Button
                          key="edit"
                          type="text"
                          icon={<EditOutlined />}
                          onClick={() => handleSelectFence(item)}
                        />,
                        <Button
                          key="delete"
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => handleDelete(item.id!)}
                        />,
                      ]}
                    >
                      <Card.Meta
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
                    </Card>
                  );
                })}
              </div>
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
