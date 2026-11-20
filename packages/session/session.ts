/**
 * 会话服务：内存权威 + 检查点落盘。
 * 对应真实仓库 packages/core/session 与 session-checkpoint-policy 的组合。
 *
 * append 只改内存并标记待写，flush 才把积压事件交给存储。
 * 于是「什么时候保证不丢」成了策略问题，而不是存储实现自己拍板。
 */

import type { Plugin } from '@pkg/cordis'
import {
  SESSION_SERVICE_NAME,
  type SessionEvent,
  type SessionInput,
  type SessionService,
  type SessionStore,
} from './types.ts'

export function sessionPlugin(store: SessionStore): Plugin {
  return {
    name: 'session',
    async apply(ctx) {
      const events: SessionEvent[] = [...(await store.load())]
      // 重启后必须接续编号，否则重放会出现两条同号事件。
      let nextSeq = (events.at(-1)?.seq ?? 0) + 1
      let pending: SessionEvent[] = []
      // 串行写链：flush 依次挂到链尾，同一时刻只有一个写循环。
      let queue: Promise<void> = Promise.resolve()

      ctx.provide<SessionService>(SESSION_SERVICE_NAME, {
        append(input) {
          const event = { ...input, seq: nextSeq, ts: Date.now() } as SessionEvent
          nextSeq += 1
          events.push(event)
          pending.push(event)
          ctx.emit('session/event', event)
          return event
        },
        events() {
          return events
        },
        flush() {
          if (pending.length === 0) return queue
          const task = queue.then(async () => {
            // 失败即停写：从 pending 头部按序写，成功才移除已写部分。
            // 失败即抛出，失败批原样留在头部——后续 flush 必须先重试成功它，
            // 更新的事件排在它后面，绝不会先落盘（守住 seq 单调不变量）。
            while (pending.length > 0) {
              const n = pending.length
              const batch = pending.slice(0, n) // 快照本批，await 期间新追加的不受影响
              await store.append(batch)
              pending = pending.slice(n) // 只移除已成功写入的前 n 条
            }
          })
          // 链自身吞掉失败以免毒化后续 flush；失败批仍留在 pending，由下次 flush 重试。
          queue = task.catch(() => undefined)
          return task
        },
      })
    },
  }
}
