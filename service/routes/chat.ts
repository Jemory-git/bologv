/**
 * 对话发起。
 *   POST /api/chat  → data: { ok: true }
 *
 * body 必须带 sessionId：路由层先 manager.switchActive(sessionId)，
 * 再 loop.run() — agentLoop 里会往 manager.active 会话写事件。
 * per-session 单飞锁防止同一会话并发 run 交错写日志。
 *
 * 参考文件只传路径：元信息与内容由服务端读取，发送前先校验模型能力，
 * 避免带着发不出去的消息进入运行态。
 *
 * 响应只表示本轮完成；本轮事件经 IPC broadcast 推送给渲染进程，
 * 历史事件经 GET /api/sessions/:id/events 拉取。
 */

import Router from '@koa/router'
import type { Booted } from '../../boot.ts'
import { ConflictError, ValidationError } from '../errors.ts'
import { assertReferencesUsable } from '../references/resolve.ts'
import type { ChatRequest } from '../../shared/dto.ts'

export function createChatRouter(bootedPromise: Promise<Booted>) {
  const router = new Router()

  router.post('/', async (ctx: KoaContext) => {
    const booted = await bootedPromise
    const body = (ctx.request.body ?? {}) as Partial<ChatRequest>

    const text = typeof body.text === 'string' ? body.text.trim() : ''
    const referencePaths = readReferencePaths(body.referencePaths)
    if (text === '' && referencePaths.length === 0) {
      throw new ValidationError('消息文本与参考文件至少需要一项')
    }

    const model = String(body.model ?? '').trim()
    if (!model) throw new ValidationError('model is required')
    const sessionId = String(body.sessionId ?? '').trim()
    if (!sessionId) throw new ValidationError('sessionId is required')

    if (booted.manager.isRunning(sessionId)) {
      throw new ConflictError('当前会话已有任务在运行中')
    }

    // 先校验参考文件存在且当前模型能处理，再占用运行态。
    const references = await assertReferencesUsable(referencePaths, model)

    // 切换到目标会话：加载实例并释放上一个空闲实例
    await booted.manager.switchActive(sessionId)

    // beginRun 内部会再次校验运行态（避免检查与占用之间的竞态）
    const started = await booted.manager.beginRun(sessionId)
    if (!started) {
      throw new ConflictError('当前会话已有任务在运行中')
    }

    try {
      await booted.loop.run({ text, references }, model)
      ctx.apiSuccess({ msg: 'ok', data: { ok: true } })
    } finally {
      await booted.manager.finishRun(sessionId)
    }
  })

  return router
}

/** 只接受非空字符串路径；去重并保持顺序。 */
function readReferencePaths(value: unknown): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new ValidationError('referencePaths 必须是数组')

  const paths: string[] = []
  for (const item of value) {
    if (typeof item !== 'string' || item.trim() === '') {
      throw new ValidationError('referencePaths 只能包含非空字符串')
    }
    paths.push(item.trim())
  }
  return [...new Set(paths)]
}
