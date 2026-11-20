/**
 * 会话历史与摘要（只读）。
 *   GET  /api/sessions            → data: SessionSummary[]
 *   GET  /api/sessions/:id/events → data: { events: SessionEvent[] }
 *
 * 事件传输只有两条路径：历史走 HTTP，增量走 IPC broadcast。
 * 当前单 session（default）；多会话是未来扩展点。
 */

import Router from '@koa/router'
import type { Booted } from '../../boot.ts'
import { ValidationError } from '../errors.ts'
import type { SessionSummary } from '../../shared/dto.ts'
import type { SessionEvent } from '@pkg/session'

export function createSessionsRouter(bootedPromise: Promise<Booted>) {
  const router = new Router()

  router.get('/', async (ctx: KoaContext) => {
    const booted = await bootedPromise
    const events = booted.session.events()
    ctx.apiSuccess({ msg: 'ok', data: [buildSummary('default', events)] })
  })

  router.get('/:id/events', async (ctx: KoaContext) => {
    const booted = await bootedPromise
    const { id } = ctx.params
    if (id !== 'default') {
      throw new ValidationError(`unknown session: ${id}`)
    }
    ctx.apiSuccess({ msg: 'ok', data: { events: [...booted.session.events()] } })
  })

  return router
}

// —— helpers ——

function buildSummary(id: string, events: readonly SessionEvent[]): SessionSummary {
  const lastActive = events.at(-1)?.ts ?? 0
  const preview = events.length > 0 ? extractPreview(events) : ''
  return { id, lastActive, preview }
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
