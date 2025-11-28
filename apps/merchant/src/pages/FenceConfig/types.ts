export interface RuleOption {
  id: number;
  name: string;
  logic: string;
  color: string;
}

export interface FenceData {
  id?: string | number; // 唯一标识，新增时为空
  fence_name: string;
  fence_desc: string;
  rule_id: number | null; // 关联的时效规则ID
  shape_type: "polygon" | "circle";
  coordinates: number[][]; // 代表多边形的坐标数组或圆心坐标
  radius: number; // For circle
}

export const ruleOptions: RuleOption[] = [
  { id: 101, name: "标准配送", logic: "60分钟达", color: "#1677ff" },
  { id: 102, name: "极速达", logic: "30分钟达", color: "#52c41a" },
  { id: 103, name: "次日达", logic: "24小时达", color: "#faad14" },
];
