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
