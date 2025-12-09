import { Button, Form, Input, Select, Space, Typography } from "antd";
import { FenceData } from "../types";
import { ruleOptions } from "../constants";
import { useEffect } from "react";

interface OperationPanelProps {
  visible: boolean;
  data: Partial<FenceData>;
  onSave: (values: FenceData) => void;
  onCancel: () => void;
  onDelete?: (id: string | number) => void;
}

export default function OperationPanel({
  visible,
  data,
  onSave,
  onCancel,
  onDelete,
}: OperationPanelProps) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible && data) {
      form.setFieldsValue(data);
    } else {
      form.resetFields();
    }
  }, [visible, data, form]);

  if (!visible) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#999" }}>
        请在地图上绘制或选择围栏
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 24,
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Typography.Title level={4}>编辑围栏</Typography.Title>
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => {
          // 注意：这里不直接传递坐标，让 handleSave 从地图覆盖物获取最新坐标
          // 因为用户可能在地图上编辑了围栏，但 data 中的坐标可能还没有更新
          onSave({
            ...data,
            ...values,
            // 保留原有的坐标数据作为后备，但 handleSave 会优先使用覆盖物的最新数据
            coordinates: data.coordinates || [],
            shape_type: data.shape_type || "polygon",
            radius: data.radius || 0,
          } as FenceData);
        }}
      >
        <Form.Item
          name="fence_name"
          label="围栏名称"
          rules={[
            { required: true, message: "请输入围栏名称" },
            { max: 30, message: "最多30个字" },
          ]}
        >
          <Input placeholder="请输入" />
        </Form.Item>

        <Form.Item
          name="fence_desc"
          label="围栏描述"
          rules={[{ max: 100, message: "最多100个字" }]}
        >
          <Input.TextArea placeholder="请输入围栏描述" />
        </Form.Item>

        <Form.Item
          name="rule_id"
          label="时效规则"
          rules={[{ required: true, message: "请选择时效规则" }]}
        >
          <Select placeholder="请选择">
            {ruleOptions.map((rule) => (
              <Select.Option key={rule.id} value={rule.id}>
                <span style={{ color: rule.color, marginRight: 8 }}>●</span>
                {rule.name} - {rule.logic}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <div
          style={{
            marginTop: "auto",
            paddingTop: 24,
            borderTop: "1px solid #f0f0f0",
            textAlign: "right",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          {data.id && onDelete ? (
            <Button danger onClick={() => onDelete(data.id!)}>
              删除
            </Button>
          ) : (
            <div />
          )}
          <Space>
            <Button onClick={onCancel}>取消</Button>
            <Button type="primary" htmlType="submit">
              保存
            </Button>
          </Space>
        </div>
      </Form>
    </div>
  );
}
