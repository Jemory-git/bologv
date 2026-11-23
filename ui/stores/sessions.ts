/**
 * 会话列表 UI 状态与动作 —— 会话功能的自洽边界。
 *
 * 组件不直接发请求：列表加载、重命名、删除都收敛在这里；
 * 选中 / 新建委托 chat store —— currentSessionId 是唯一选中态事实源。
 *
 * 删除语义：删掉当前会话后自动回退到列表第一个会话；
 * 没有剩余会话则进入草稿态。
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { deleteSession, getSessionEvents, getSessions, renameSession } from '@ui/http'
import { useChatStore } from './chat.ts'
import type { SessionSummary } from '@ui/types/view-model.ts'

export const useSessionsStore = defineStore('sessions', () => {
  //states
  const items = ref<SessionSummary[]>([])
  const loading = ref(false)
  /** 最近一次列表操作的错误文案；成功后清空。 */
  const error = ref<string | null>(null)

  //methods
  async function load(): Promise<void> {
    loading.value = true
    const [, body] = await getSessions()
    loading.value = false
    if (body.code !== 0) {
      error.value = `会话列表获取失败：${body.msg || 'api error'}`
      return
    }
    error.value = null
    items.value = (body.data ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      subtitle: item.lastActive > 0 ? formatActive(item.lastActive) : '',
    }))
  }

  async function select(id: string): Promise<void> {
    await useChatStore().switchSession(id, getSessionEvents)
  }

  /** 新建对话 = 进入草稿态；真实会话在首条消息发送时创建。 */
  function startNew(): void {
    useChatStore().startNew()
  }

  async function rename(id: string, title: string): Promise<void> {
    const [, body] = await renameSession(id, title)
    if (body.code !== 0) {
      error.value = `重命名失败：${body.msg || 'api error'}`
      return
    }
    error.value = null
    await load()
  }

  async function remove(id: string): Promise<void> {
    const [, body] = await deleteSession(id)
    if (body.code !== 0) {
      error.value = `删除失败：${body.msg || 'api error'}`
      return
    }
    error.value = null

    const chat = useChatStore()
    const removingActive = chat.currentSessionId === id
    await load()
    if (!removingActive) return

    const next = items.value[0]
    if (next === undefined) chat.startNew()
    else await chat.switchSession(next.id, getSessionEvents)
  }

  return { items, loading, error, load, select, startNew, rename, remove }
})

// —— helpers ——

function formatActive(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
