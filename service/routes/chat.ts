/**
 * 对话发起。
 *   POST /api/chat  → data: { ok: true }
 *
 * body 必须带 sessionId：路由层先 manager.switchActive(sessionId)，
 * 再 loop.run() — agentLoop 里会往 manager.active 会话写事件。
 * per-session 单飞锁防止同一会话并发 run 交错写日志。
 *
 * 响应只表示本轮完成；本轮事件经 IPC broadcast 推送给渲染进程，
 * 历史事件经 GET /api/sessions/:id/events 拉取。
 */

import Router from '@koa/router'
import type { Booted } from '../../boot.ts'
import { ConflictError, ValidationError } from '../errors.ts'
import type { ChatRequest } from '../../shared/dto.ts'

export function createChatRouter(bootedPromise: Promise<Booted>) {
  const router = new Router()

  router.post('/', async (ctx: KoaContext) => {
    const booted = await bootedPromise
    const body = (ctx.request.body ?? {}) as ChatRequest

    const text = String(body.text ?? '').trim()
    if (!text) throw new ValidationError('text is required')
    const model = String(body.model ?? '').trim()
    if (!model) throw new ValidationError('model is required')
    const sessionId = String(body.sessionId ?? '').trim()
    if (!sessionId) throw new ValidationError('sessionId is required')

    booted.manager.switchActive(sessionId)

    if (booted.manager.isRunning(sessionId)) {
      throw new ConflictError('当前会话已有任务在运行中')
    }
    booted.manager.setRunning(sessionId, true)

    try {
      await booted.loop.run(text, model)
      ctx.apiSuccess({ msg: 'ok', data: { ok: true } })
    } finally {
      booted.manager.setRunning(sessionId, false)
    }
  })

  return router
}
