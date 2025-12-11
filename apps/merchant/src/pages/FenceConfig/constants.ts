import { RuleOption } from "./types";

// 商家门店位置常量，需要根据后端数据动态设置
export const MERCHANT_LOCATION: [number, number] = [120.301663, 30.297455]; // 示例：杭州坐标

// 时效规则选项
export const ruleOptions: RuleOption[] = [
  { id: 101, name: "标准配送", logic: "标准配送", color: "#1677ff" },
  { id: 102, name: "极速达", logic: "极速配送", color: "#52c41a" },
];
