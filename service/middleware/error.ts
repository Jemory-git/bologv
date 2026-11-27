/**
 * 顶层错误处理中间件：错误 → 响应 envelope 的唯一翻译点。
 *   - AppError 子类    → ctx.apiError → HTTP 200 + code:-1 + errCode
 *   - LLMConfigError   → ctx.apiError（LLM 配置域错误）
 *   - LLMResponseError → ctx.apiError（上游模型响应非法）
 *   - StorageError     → ctx.apiError（会话持久化失败，UI 常驻告警）
 *   - 其余未知异常     → HTTP 500 + { error } 直出（UI 公共错误通道）
 */

import { LLMConfigError, LLMResponseError } from '@pkg/models'
import { StorageError } from '@pkg/session'
import { AppError } from '../errors.ts'
import type { Next } from 'koa'

export function errorMiddleware() {
  return async (ctx: KoaContext, next: Next) => {
    try {
      await next()
    } catch (err) {
      if (err instanceof AppError) {
        ctx.apiError({ msg: err.message, errCode: err.status })
      } else if (err instanceof LLMConfigError) {
        ctx.apiError({ msg: err.message, errCode: err.errCode })
      } else if (err instanceof LLMResponseError) {
        ctx.apiError({ msg: err.message, errCode: err.errCode })
      } else if (err instanceof StorageError) {
        ctx.apiError({ msg: err.message, errCode: err.errCode })
      } else {
        ctx.status = 500
        ctx.body = { error: err instanceof Error ? err.message : String(err) }
      }
    }
  }
}
