import { z } from "zod";

// 基础坐标数组校验：必须是 [number, number]，用于 recipientCoords
// Zod 的 .tuple([T1, T2]) 确保数组的长度和每个元素的类型
const CoordinateSchema = z.tuple([
  z.number().min(-180).max(180), // 经度 (Longitude)
  z.number().min(-90).max(90), // 纬度 (Latitude)
]);

// 异常类型枚举
const AnomalyTypeSchema = z.enum([
  "none",
  "routeDeviation",
  "longTimeStopped",
  "longTimeNoUpdate",
]);

// 订单创建请求体的校验
export const CreateOrderSchema = z
  .object({
    // 基础业务字段
    userId: z
      .string()
      .uuid("用户ID格式不正确，应为UUID")
      .or(z.string().min(1, "用户ID不能为空")), // 假设用户ID可能是UUID或普通字符串
    amount: z.number().positive("金额必须大于0"),

    // 地址信息
    recipientName: z.string().min(2, "收货人姓名至少2个字符"),
    recipientAddress: z.string().min(5, "收货地址描述不能太短"),

    // 地理坐标 (核心字段)
    recipientCoords: CoordinateSchema.describe(
      "收货地址坐标，格式应为 [经度(lng), 纬度(lat)]"
    ),

    // merchantId 在你的 DTO 中是可选的，但在 Controller 中我们模拟设置。
    // 如果前端需要传入，则在此处校验。如果仅由后端设置，则不需要在此处校验。
    // 鉴于你的 CreateOrderDTO 包含了 merchantId，我们在此处校验：
    merchantId: z.string().min(1, "商家ID不能为空"),

    // 异常订单类型（可选）
    anomalyType: AnomalyTypeSchema.optional().describe(
      "异常订单类型：none(正常), routeDeviation(轨迹偏移), longTimeStopped(长时间不动), longTimeNoUpdate(长时间未更新)"
    ),
  })
  .strict("请求体中包含未定义的额外字段"); // 推荐使用 .strict() 避免传输不必要的字段

export const ShippingSchema = z
  .object({
    // 配送方式现在由 ruleId 承载
    ruleId: z.number().int().positive("时效规则ID必须是正整数"),

    // 预估路径：必须是数组，每个元素是 [number, number] 坐标
    routePath: z
      .array(
        z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])
      )
      .min(2, "预估路径至少包含起点和终点两个坐标点"),
  })
  .strict("请求体中包含未定义的额外字段");
