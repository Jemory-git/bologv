/**
 * 会话存储域错误：持久化失败（磁盘满 / 权限 / 文件锁等）。
 *
 * 属于域契约，定义方不依赖 service。边界（errorMiddleware）把它翻译成
 * apiError envelope，让 UI 拿到可读消息并常驻告警——而不是静默丢数据。
 */

/** 持久化失败，errCode 500（服务端故障，但消息可读、用户可纠正）。 */
export class StorageError extends Error {
  readonly errCode: number
  /** 原始 OS 错误码，如 ENOSPC / EACCES / EBUSY。 */
  readonly code: string
  constructor(message: string, code: string) {
    super(message)
    this.name = 'StorageError'
    this.code = code
    this.errCode = 500
  }
}
