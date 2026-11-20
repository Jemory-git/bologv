/**
 * HTTP 层业务错误定义。
 *
 * handler 里 throw AppError 子类表示**业务错误**（参数错、找不到、冲突）；
 * 错误 → envelope 的翻译统一在 middleware/error.ts 的 errorMiddleware。
 */

/** 所有业务错误的基类，携带 status（映射到 errCode）。 */
export class AppError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'AppError'
    this.status = status
  }
}

/** 400 — 参数缺失、类型不符。 */
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400)
    this.name = 'ValidationError'
  }
}

/** 404 — 请求的资源不存在。 */
export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404)
    this.name = 'NotFoundError'
  }
}

/** 409 — 资源状态冲突（如 session 已在运行中）。 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409)
    this.name = 'ConflictError'
  }
}
