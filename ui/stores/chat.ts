/**
 * 对话 UI 状态：当前会话 + 对话条目 + 发送锁。
 *
 * 纯 Pinia store，无任何 Cordis / bridge 依赖。
 * 初始化（HTTP 恢复历史 + 订阅 onEvent）由 main.ts 负责。
 *
 * seen 集合按 (sessionId, seq) 去重：历史恢复与实时推送可能重叠，
 * 加上可能包含不同会话的事件，双重 key 保证不乱入。
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ChatEntry } from '@ui/types/view-model.ts'
import type { SessionEvent } from '@pkg/session'

/** 简化版响应体：switchSession 的 fetchFn 参数类型对齐 http.get 返回值。 */
type RespBody = { code: number; msg: string; data?: { events: SessionEvent[] }; errCode?: number; errMsg?: string }
type FetchFn = (id: string) => Promise<[Error | null, RespBody, Response | null]>

export const useChatStore = defineStore('chat', () => {
  //states
  const currentSessionId = ref<string | null>(null)
  const entries = ref<readonly ChatEntry[]>([])
  const pending = ref(false)
  /** 已入列事件的 (sessionId, seq)；内部簿记，不需要响应式。 */
  const seen = new Set<string>()

  /**
   * 切换会话的内部状态：
   * - switchTarget 非空表示有一次历史拉取在途；该会话的实时事件先缓冲，提交后补入
   * - switchSeq 单调递增，最后一次点击生效，早先的响应直接作废
   */
  let switchTarget: string | null = null
  let switchBuffer: SessionEvent[] = []
  let switchSeq = 0

  //methods
  function append(entry: ChatEntry): void {
    entries.value = [...entries.value, entry]
  }

  /**
   * 实时事件入口（main.ts 把所有 session/event 都交给这里）。
   * 当前会话 → 直接入列；切换目标会话 → 缓冲等提交；其它会话 → 丢弃。
   */
  function appendEvent(event: SessionEvent): void {
    if (switchTarget !== null && event.sessionId === switchTarget) {
      switchBuffer.push(event)
      return
    }
    if (currentSessionId.value === null || event.sessionId !== currentSessionId.value) return
    const key = `${event.sessionId}:${event.seq}`
    if (seen.has(key)) return
    seen.add(key)
    append({ kind: 'event', event })
  }

  function appendError(text: string): void {
    append({ kind: 'error', text })
  }

  function setPending(value: boolean): void {
    pending.value = value
  }

  /** 作废在途的切换请求（startNew / openSession 等抢先改变当前会话时调用）。 */
  function cancelSwitch(): void {
    switchSeq += 1
    switchTarget = null
    switchBuffer = []
  }

  /** 清空对话区（切换会话时调用）；保留 currentSessionId 不变。 */
  function clearEntries(): void {
    entries.value = []
    seen.clear()
  }

  /** 进入新对话草稿态：只清空界面，不创建后端会话；首条消息发送时才创建。 */
  function startNew(): void {
    cancelSwitch()
    clearEntries()
    currentSessionId.value = null
  }

  /** 直接打开一个会话（不拉历史）；用于刚创建、尚无事件的空会话。 */
  function openSession(id: string): void {
    cancelSwitch()
    clearEntries()
    currentSessionId.value = id
  }

  /**
   * 切换到已有会话：先拉历史，拿到结果后一次性替换界面。
   *
   * 拉取期间旧会话保持原样（不高亮、不清空），避免闪空；
   * 重复点击当前会话直接忽略；连续点击不同会话时最后一次生效。
   *
   * @param id        目标会话 id
   * @param fetchFn   http.getSessionEvents（tuple 返回），由调用方注入避免循环 import
   */
  async function switchSession(id: string, fetchFn: FetchFn): Promise<void> {
    if (id === currentSessionId.value) return

    const ticket = ++switchSeq
    switchTarget = id
    switchBuffer = []

    const [, body] = await fetchFn(id)
    if (ticket !== switchSeq) return // 已有更新的切换/新建动作，本次结果作废

    if (body.code !== 0) {
      switchTarget = null
      switchBuffer = []
      appendError(`历史恢复失败：${body.msg || 'api error'}`)
      return
    }

    // 原子提交：先换 id，再一次性灌入历史 + 切换窗口内缓冲的实时事件
    clearEntries()
    currentSessionId.value = id
    switchTarget = null
    for (const event of body.data?.events ?? []) appendEvent(event)
    for (const event of switchBuffer) appendEvent(event)
    switchBuffer = []
  }

  //expose
  return {
    currentSessionId,
    entries,
    pending,
    append,
    appendEvent,
    appendError,
    setPending,
    clearEntries,
    startNew,
    openSession,
    switchSession,
  }
})
