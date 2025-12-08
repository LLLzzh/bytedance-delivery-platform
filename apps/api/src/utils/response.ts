interface ApiResponse<T = unknown> {
  code: number; // 业务状态码 (0 成功，非 0 失败)
  data: T | null; // 实际返回数据
  msg: string; // 消息
}

// 统一响应构造器类
class ResponseBuilder {
  /**
   * 构建成功响应
   * @param data 实际返回的业务数据
   * @param msg 消息，默认为 "Success"
   * @returns ApiResponse 结构
   */
  static success<T>(data: T, msg: string = "Success"): ApiResponse<T> {
    return {
      code: 0,
      data: data,
      msg: msg,
    };
  }

  /**
   * 构建业务失败响应
   * @param code 业务错误码（必须是非 0 的数字，例如 40001）
   * @param msg 错误消息
   * @param data 可选的附带数据（如校验失败详情）
   * @returns ApiResponse 结构
   */
  static fail(
    code: number,
    msg: string,
    data: unknown = null
  ): ApiResponse<unknown> {
    // 确保使用非 0 状态码
    if (code === 0) {
      console.warn(
        "Attempted to use code 0 for a failure response. Defaulting to 40000."
      );
      code = 40000;
    }

    return {
      code: code,
      data: data,
      msg: msg,
    };
  }
}

export default ResponseBuilder;

// 推荐的业务错误码
export const ERROR_CODES = {
  SUCCESS: 0,
  INVALID_INPUT: 40001, // Zod 等校验失败
  DELIVERY_OUT_OF_RANGE: 40002, // 配送范围校验失败
  NOT_FOUND: 40401, // 资源未找到 (业务层面)
  INTERNAL_SERVER_ERROR: 50000, // 未捕获的内部错误
};
