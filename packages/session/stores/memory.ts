/**
 * 存储 Provider 之一：纯内存。
 * 进程退出即丢失，用于不关心持久化的场景。
 *
 * 它的存在是为了证明存储是一层可替换的实现——会话服务并不知道事件去了哪里。
 */

import type { SessionEvent, SessionStore } from '../types.ts'

export function memoryStore(): SessionStore {
  const events: SessionEvent[] = []
  return {
    async load() {
      return [...events]
    },
    async append(batch) {
      events.push(...batch)
    },
    async close() {
      // 没有需要释放的资源。
    },
  }
}
