// src/modules/fence/fence.schema.ts
import { z } from "zod";

// 基础坐标数组校验：必须是 [number, number]
const CoordinateSchema = z.tuple([z.number(), z.number()]);

// 核心坐标数组校验：必须是 number[][]
const CoordinatesSchema = z.array(CoordinateSchema);

// 新增围栏请求体校验
export const CreateFenceSchema = z
  .object({
    fenceName: z.string().min(1, "围栏名称不能为空"),
    fenceDesc: z.string().optional(),
    ruleId: z.number().nullable().default(null),

    // 形状校验
    shapeType: z.enum(["polygon", "circle"]),

    // 坐标校验
    coordinates: CoordinatesSchema.min(1, "至少需要一个坐标点"),

    // 半径校验
    radius: z.number().nonnegative().default(0),
  })
  .refine(
    (data) => {
      // 业务规则：圆形必须有半径 > 0
      if (data.shapeType === "circle") {
        return data.radius > 0;
      }
      // 业务规则：多边形必须有至少3个点
      if (data.shapeType === "polygon") {
        return data.coordinates.length >= 3;
      }
      return true; // 其他情况通过
    },
    {
      message: "圆形必须指定半径，多边形至少需要3个点",
      path: ["shapeType", "radius", "coordinates"],
    }
  );
