/**
 * 会话服务工厂：内存事件数组 + 串行 flush 链。
 *
 * SessionService 不走 Cordis Service 通道——它按会话 id 产生多份实例，
 * 由 SessionManager 缓存和分发。每个实例内部维护独立的：
 *   events[]  事件事实源（load 时读取 + append 时追加）
 *   pending[] 待落盘队列
 *   queue     串行 flush 链（保证 seq 单调写入）
 *   nextSeq   会话内单调编号
 *
 * append 只改内存并标记待写；flush 才把积压事件交给存储。
 * 事件产生时会调用 onEvent 回调（通常是 SessionManager 传入的 ctx.emit），
 * 供 IPC broadcast 等订阅方实时消费。
 */

import type { SessionEvent, SessionInput, SessionService, SessionStore } from './types.ts'

export interface CreateSessionServiceOptions {
  /** 会话 id；每条事件都会带上。 */
  sessionId: string
  /** 事件产生时的回调（通常是 (e) => ctx.emit('session/event', e)）。 */
  onEvent?: (event: SessionEvent) => void
}

/**
 * 生成一个绑定特定 store + sessionId 的 SessionService。
 * 启动时从 store.load() 恢复历史事件，保证重启后 seq 继续递增。
 */
export function createSessionService(
  store: SessionStore,
  { sessionId, onEvent }: CreateSessionServiceOptions,
): SessionService {
  let events: SessionEvent[] = []
  let nextSeq = 1
  const pending: SessionEvent[] = []
  let queue: Promise<void> = Promise.resolve()

  const loading = store.load().then((loaded) => {
    events = loaded
    nextSeq = (loaded.at(-1)?.seq ?? 0) + 1
  })

  const service: SessionService = {
    id: sessionId,

    append(input) {
      const event: SessionEvent = {
        ...input,
        sessionId,
        seq: nextSeq,
        ts: Date.now(),
      }
      nextSeq += 1
      events.push(event)
      pending.push(event)
      onEvent?.(event)
      return event
    },

    events() {
      return events
    },

    flush() {
      if (pending.length === 0) return queue
      const task = queue.then(async () => {
        while (pending.length > 0) {
          const n = pending.length
          const batch = pending.slice(0, n)
          await store.append(batch)
          pending.splice(0, n)
        }
      })
      queue = task.catch(() => undefined)
      return task
    },

    async close() {
      await loading.catch(() => undefined)
      await store.close()
    },
  }

  ;(service as unknown as { _loading: Promise<void> })._loading = loading

  return service
}

/** 等 createSessionService 返回的实例 load() 完成。 */
export function awaitSessionReady(service: SessionService): Promise<void> {
  return (service as unknown as { _loading: Promise<void> })._loading
}
