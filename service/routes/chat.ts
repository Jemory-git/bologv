/**
 * 对话发起。
 *   POST /api/chat  → data: { ok: true }
 *
 * 响应只表示本轮完成；本轮事件经 IPC broadcast 推送给渲染进程，
 * 历史事件经 GET /api/sessions/:id/events 拉取——事件数据只有这两条传输路径。
 *
 * 预留扩展点：未来要 SSE 流式时，把 handler 里同步 run 换成 async iterable
 * 消费 + ctx.responseStream()，路由文件结构不变。
 */

import Router from '@koa/router'
import type { Booted } from '../../boot.ts'
import { ConflictError, ValidationError } from '../errors.ts'
import type { ChatRequest } from '../../shared/dto.ts'

export function createChatRouter(bootedPromise: Promise<Booted>) {
  const router = new Router()
  // 单飞锁：一棵插件树只有一个 session，同一时刻只允许一轮 run。
  // 并发 run 会交错写事件日志。
  let running = false

  router.post('/', async (ctx: KoaContext) => {
    const booted = await bootedPromise

    const body = (ctx.request.body ?? {}) as ChatRequest
    const text = String(body.text ?? '').trim()
    if (!text) {
      throw new ValidationError('text is required')
    }
    const model = String(body.model ?? '').trim()
    if (!model) {
      throw new ValidationError('model is required')
    }

    if (running) {
      throw new ConflictError('session 已在运行中')
    }
    running = true
    try {
      await booted.loop.run(text, model)
      ctx.apiSuccess({ msg: 'ok', data: { ok: true } })
    } finally {
      running = false
    }
  })

  return router
}
