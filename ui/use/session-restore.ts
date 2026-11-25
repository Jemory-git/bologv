/**
 * 会话启动恢复：实时事件缓冲 → 拉取会话列表 → 选中最近会话 → 回灌缓冲。
 *
 * 这段顺序不能拆散：
 *   1. setup 阶段先订阅实时事件，恢复期间到达的事件进入缓冲；
 *   2. 挂载后拉会话列表，选中最近会话（无历史则进入草稿态）；
 *   3. 恢复完成后再把缓冲事件交回 store，由它按会话归属分派。
 *
 * 由 App.vue（组合根）整体调用一次，不散落到侧栏或对话组件。
 * Electron 启动信息不在这里拉取：那是 electronBridge 装配时的自有职责。
 */

import { onMounted, onUnmounted } from 'vue'
import { BRIDGE_SERVICE } from '@ui/plugins/core/electron-bridge.ts'
import { useChatStore } from '@ui/stores/chat.ts'
import { useSessionsStore } from '@ui/stores/sessions.ts'
import { useService } from './ctx-service.ts'
import type { BridgeService } from '@ui/plugins/core/electron-bridge.ts'
import type { SessionEvent } from '@pkg/session'

export function useSessionRestore(): void {
  //states
  const bridge = useService<BridgeService>(BRIDGE_SERVICE)
  const chat = useChatStore()
  const sessions = useSessionsStore()

  const buffered: SessionEvent[] = [] // 如果有对话在跑，重载页面可能会丢事件，需要接住
  let restoring = true

  //hooks
  const off = bridge.onEvent((event) => {
    if (restoring) buffered.push(event)
    else chat.appendEvent(event)
  })

  onUnmounted(off)

  onMounted(async () => {
    try {
      await sessions.load()
      const initialId = sessions.items[0]?.id ?? null
      if (initialId === null) chat.startNew()
      else await sessions.select(initialId)
    } catch (error) {
      chat.appendError(`启动失败：${String(error)}`)
    } finally {
      restoring = false
      for (const event of buffered) chat.appendEvent(event)
    }
  })
}
