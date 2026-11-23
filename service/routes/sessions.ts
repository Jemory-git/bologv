/**
 * 会话管理路由：列出 / 创建 / 读取历史 / 重命名。
 *
 *   GET    /api/sessions            → data: SessionSummary[]（按最近活跃倒序）
 *   POST   /api/sessions            → data: { id }（新建空会话，返回 id）
 *   GET    /api/sessions/:id/events → data: { events: SessionEvent[] }
 *   PATCH  /api/sessions/:id        → data: { id, title }（重命名，写 meta.json）
 *   DELETE /api/sessions/:id        → data: { id }（删除目录；运行中的会话拒绝删除）
 *
 * 事件传输两条路径：历史走 HTTP，增量走 IPC broadcast（broadcast 载荷自带 sessionId）。
 */

import Router from '@koa/router'
import type { Booted } from '../../boot.ts'
import type { SessionRenameRequest, SessionSummary } from '../../shared/dto.ts'
import type { SessionEvent } from '@pkg/session'

/** 标题长度上限（字符）。 */
const TITLE_MAX = 100

export function createSessionsRouter(bootedPromise: Promise<Booted>) {
  const router = new Router()

  // GET / — 列出磁盘上全部会话（scan directories），逐个生成摘要。
  router.get('/', async (ctx: KoaContext) => {
    const booted = await bootedPromise
    const ids = await booted.manager.list()
    const summaries = await Promise.all(
      ids.map(async (id) => {
        const events = booted.manager.get(id).events()
        return buildSummary(id, events, await booted.manager.getTitle(id))
      }),
    )
    // 最近活跃优先；无事件的会话（lastActive=0）按 id（≈ 创建时间）倒序垫底。
    summaries.sort((a, b) => b.lastActive - a.lastActive || b.id.localeCompare(a.id))
    ctx.apiSuccess({ msg: 'ok', data: summaries })
  })

  // POST / — 创建新空会话。
  router.post('/', async (ctx: KoaContext) => {
    const booted = await bootedPromise
    const created = booted.manager.create()
    ctx.apiSuccess({ msg: 'ok', data: { id: created.id } })
  })

  // GET /:id/events — 读取指定会话的完整事件历史。
  router.get('/:id/events', async (ctx: KoaContext) => {
    const booted = await bootedPromise
    const { id: rawId } = ctx.params
    const id = String(rawId ?? '')
    const session = booted.manager.get(id)
    ctx.apiSuccess({ msg: 'ok', data: { events: [...session.events()] } })
  })

  // PATCH /:id — 重命名：只写 meta.json，不动事件日志。
  router.patch('/:id', async (ctx: KoaContext) => {
    const booted = await bootedPromise
    const id = String(ctx.params.id ?? '')
    const body = ctx.request.body as Partial<SessionRenameRequest> | undefined
    const title = typeof body?.title === 'string' ? body.title.trim() : ''

    if (title === '') {
      ctx.apiError({ msg: '标题不能为空', errCode: 400 })
      return
    }
    if (title.length > TITLE_MAX) {
      ctx.apiError({ msg: `标题不能超过 ${TITLE_MAX} 个字符`, errCode: 400 })
      return
    }

    await booted.manager.rename(id, title)
    ctx.apiSuccess({ msg: 'ok', data: { id, title } })
  })

  // DELETE /:id — 删除会话：运行中拒绝，随后 flush / close / 移除目录。
  router.delete('/:id', async (ctx: KoaContext) => {
    const booted = await bootedPromise
    const id = String(ctx.params.id ?? '')

    if (booted.manager.isRunning(id)) {
      ctx.apiError({ msg: '会话正在运行，暂时无法删除', errCode: 409 })
      return
    }

    await booted.manager.remove(id)
    ctx.apiSuccess({ msg: 'ok', data: { id } })
  })

  return router
}

// —— helpers ——

function buildSummary(id: string, events: readonly SessionEvent[], metaTitle: string | null): SessionSummary {
  return {
    id,
    title: metaTitle ?? fallbackTitle(id, events),
    lastActive: events.at(-1)?.ts ?? 0,
    preview: extractPreview(events),
  }
}

/** 未重命名时的标题：首条用户消息 > 「会话 xxxxxx」。 */
function fallbackTitle(id: string, events: readonly SessionEvent[]): string {
  const firstUser = events.find((ev) => ev.type === 'user/message')
  if (firstUser === undefined) return `会话 ${id.slice(-6)}`
  return truncate(firstUser.text, 40)
}

function extractPreview(events: readonly SessionEvent[]): string {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const ev = events[i]!
    if (ev.type === 'user/message' || ev.type === 'assistant/message') {
      return truncate(ev.text, 80)
    }
  }
  return ''
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '…' : text
}
