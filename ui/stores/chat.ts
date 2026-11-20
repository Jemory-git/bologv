/**
 * 对话 UI 状态：对话条目 + 发送锁。
 *
 * 纯 Pinia store，无任何 Cordis / bridge 依赖。
 * 初始化（HTTP 恢复历史 + 订阅 onEvent）由 main.ts 负责。
 * 事件按 seq 去重：历史恢复与实时推送可能重叠，同一事件只入列一次。
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ChatEntry } from '@ui/types/view-model.ts'
import type { SessionEvent } from '@pkg/session'

export const useChatStore = defineStore('chat', () => {
  //states
  const entries = ref<readonly ChatEntry[]>([])
  const pending = ref(false)
  /** 已入列事件的 seq；内部簿记，不需要响应式。 */
  const seenSeqs = new Set<number>()

  //methods
  function append(entry: ChatEntry): void {
    entries.value = [...entries.value, entry]
  }

  function appendEvent(event: SessionEvent): void {
    if (seenSeqs.has(event.seq)) return
    seenSeqs.add(event.seq)
    append({ kind: 'event', event })
  }

  function appendError(text: string): void {
    append({ kind: 'error', text })
  }

  function setPending(value: boolean): void {
    pending.value = value
  }

  function clear(): void {
    entries.value = []
    seenSeqs.clear()
  }

  //expose
  return { entries, pending, append, appendEvent, appendError, setPending, clear }
})
