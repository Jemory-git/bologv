import './styles/index.scss'
import { createPinia } from 'pinia'
import { createRoot } from '@pkg/cordis'
import { BRIDGE_SERVICE, electronBridge } from './plugins/core/electron-bridge.ts'
import { pluginRegistry } from './plugins/core/plugin-registry.ts'
import { windowControls } from './plugins/titlebar/window-controls/window-controls.ts'
import { pluginsPage } from './plugins/plugins-page/plugins-page.ts'
import { RENDERER_SERVICE, vueRenderer } from './renderer/vue-renderer.ts'
import { useChatStore } from './stores/chat.ts'
import { useSessionsStore } from './stores/sessions.ts'
import type { RendererService } from './renderer/vue-renderer.ts'
import type { BridgeService } from './plugins/core/electron-bridge.ts'
import type { SessionEvent } from '@pkg/session'

async function main(): Promise<void> {
  const rootCtx = createRoot()
  window.addEventListener('beforeunload', () => rootCtx.close())

  const pinia = createPinia()
  const chat = useChatStore(pinia)
  const sessions = useSessionsStore(pinia)

  rootCtx.on('plugin/error', (payload) => {
    const { id, error } = payload as { id: string; error: unknown }
    chat.appendError(`插件 ${id}：${error instanceof Error ? error.message : String(error)}`)
  })

  // Cordis 插件装配顺序（见各插件注释）
  await rootCtx.use(vueRenderer)
  await rootCtx.use(electronBridge)
  await rootCtx.use(pluginRegistry)
  await rootCtx.use(windowControls)
  await rootCtx.use(pluginsPage)

  const bridge = rootCtx.require<BridgeService>(BRIDGE_SERVICE)

  // —— 初始化：选一个会话作为启动默认 ——
  try {
    await bridge.boot()

    // 先订阅再拉历史：恢复窗口内到达的实时事件先缓冲，历史就位后按序补入。
    // 事件的会话归属过滤由 chat store 统一负责（当前会话 / 切换目标 / 丢弃）。
    const buffered: SessionEvent[] = []
    let restoring = true
    bridge.onEvent((event) => {
      if (restoring) buffered.push(event)
      else chat.appendEvent(event)
    })

    // 决定初始选中的会话：有历史就打开最近一个，否则进入草稿态（不预创建空会话）
    await sessions.load()
    const initialId = sessions.items[0]?.id ?? null
    if (initialId !== null) {
      await sessions.select(initialId)
    } else {
      chat.startNew()
    }

    restoring = false
    // 恢复窗口内缓冲的事件统一切给 store，由它按会话归属分派
    for (const event of buffered) chat.appendEvent(event)
  } catch (error) {
    chat.appendError(`启动失败：${String(error)}`)
  }

  // —— 挂载 Vue app ——
  const renderer = rootCtx.require<RendererService>(RENDERER_SERVICE)
  renderer.mount((app) => app.use(pinia))
}

void main()
