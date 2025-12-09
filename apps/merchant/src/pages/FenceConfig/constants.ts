import { RuleOption } from "./types";

// 商家门店位置常量，需要根据后端数据动态设置
export const MERCHANT_LOCATION: [number, number] = [116.397428, 39.90923];

// 时效规则选项
export const ruleOptions: RuleOption[] = [
  { id: 101, name: "标准配送", logic: "60分钟达", color: "#1677ff" },
  { id: 102, name: "极速达", logic: "30分钟达", color: "#52c41a" },
  { id: 103, name: "次日达", logic: "24小时达", color: "#faad14" },
];
