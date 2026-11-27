/**
 * LLM 域错误：provider 可信号的业务失败（配置类 / 响应类）。
 *
 * 属于域契约的一部分——定义方不依赖 service。
 * 边界（errorMiddleware）把域错误翻译成 apiError envelope，
 * 其余未知异常仍走 HTTP 500 → UI 公共错误通道。
 */

/** 配置类业务错误基类，携带 errCode 供边界映射。 */
export class LLMConfigError extends Error {
  readonly errCode: number
  constructor(message: string, errCode: number) {
    super(message)
    this.name = 'LLMConfigError'
    this.errCode = errCode
  }
}

/** 404 — 请求的模型在最新配置中无法解析（无厂商或 modelId 不存在）。 */
export class ModelNotFoundError extends LLMConfigError {
  constructor(message: string) {
    super(message, 404)
    this.name = 'ModelNotFoundError'
  }
}

/** 400 — 厂商的 apiKeyEnv 环境变量未设置。 */
export class ApiKeyMissingError extends LLMConfigError {
  constructor(message: string) {
    super(message, 400)
    this.name = 'ApiKeyMissingError'
  }
}

/** 502 — 上游模型响应形状不符或工具参数无法解析。 */
export class LLMResponseError extends Error {
  readonly errCode: number
  constructor(message: string) {
    super(message)
    this.name = 'LLMResponseError'
    this.errCode = 502
  }
}
