import './styles/index.scss'
import { createPinia } from 'pinia'
import { createRoot } from '@pkg/cordis'
import { BRIDGE_SERVICE, electronBridge } from './plugins/core/electron-bridge.ts'
import { pluginRegistry } from './plugins/core/plugin-registry.ts'
import { pluginsPage } from './plugins/plugins-page/plugins-page.ts'
import { RENDERER_SERVICE, vueRenderer } from './renderer/vue-renderer.ts'
import { getSessionEvents } from '@ui/http'
import { useChatStore } from './stores/chat.ts'
import type { RendererService } from './renderer/vue-renderer.ts'
import type { BridgeService } from './plugins/core/electron-bridge.ts'
import type { SessionEvent } from '@pkg/session'

async function main(): Promise<void> {
  const rootCtx = createRoot()
  window.addEventListener('beforeunload', () => rootCtx.close())

  const pinia = createPinia()
  const chat = useChatStore(pinia) // 未挂进 app 时需显式传入 pinia 实例

  // 插件异常（异步初始化失败 / 启用状态持久化失败）→ 对话区可见告警。
  rootCtx.on('plugin/error', (payload) => {
    const { id, error } = payload as { id: string; error: unknown }
    chat.appendError(`插件 ${id}：${error instanceof Error ? error.message : String(error)}`)
  })

  // Cordis 插件装配顺序：
  //   vueRenderer → electronBridge → pluginRegistry（需在 fixed 插件之前） → pluginsPage
  await rootCtx.use(vueRenderer)
  await rootCtx.use(electronBridge)
  await rootCtx.use(pluginRegistry)
  await rootCtx.use(pluginsPage)

  const bridge = rootCtx.require<BridgeService>(BRIDGE_SERVICE)

  // —— 初始化（boot + 恢复历史 + 订阅事件）——
  // await 到 boot 完成（无论 resolve 还是 reject），再 mount Vue app。
  // 这样首帧就是正确状态：要么有恢复历史，要么显示启动错误——不会先空白再闪跳。
  try {
    await bridge.boot() // 外壳信息（状态栏消费）；会话历史走 HTTP

    // 先订阅再拉历史：恢复窗口内到达的实时事件先缓冲，历史就位后按序补入；
    // 两条路径的重叠事件由 chat store 按 seq 去重，不会重复入列。
    const buffered: SessionEvent[] = []
    let restoring = true
    bridge.onEvent((event) => {
      if (restoring) buffered.push(event)
      else chat.appendEvent(event)
    })

    const [err, body] = await getSessionEvents('default')
    if (err) {
      chat.appendError(`历史恢复失败：${err.message}`)
    } else if (body.code !== 0) {
      chat.appendError(`历史恢复失败：${body.msg || 'api error'}`)
    } else {
      const events = body.data?.events ?? []
      if (events.length > 0) {
        chat.append({ kind: 'notice', text: `已从日志恢复 ${events.length} 条事件。` })
        for (const event of events) chat.appendEvent(event)
      }
    }
    restoring = false
    for (const event of buffered) chat.appendEvent(event)
  } catch (error) {
    chat.appendError(`启动失败：${String(error)}`)
  }

  // —— 挂载 Vue app（pinia 通过 setup 回调注入）——
  const renderer = rootCtx.require<RendererService>(RENDERER_SERVICE)
  renderer.mount((app) => app.use(pinia))
}

void main()
