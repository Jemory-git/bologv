/**
 * 渲染进程入口：纯组装。
 *
 * 只负责：
 *   1. 创建 Cordis 根作用域与 Pinia；
 *   2. use(pluginRegistry) —— 固定插件装配与其余插件启停都由它负责；
 *   3. 从 renderer 服务拿到挂载入口，挂载 Vue。
 *
 * 会话恢复（事件缓冲、历史列表、初始会话选中）不属于组装层，
 * 见 App.vue 调用的 @ui/use/session-restore.ts。
 */

import './styles/index.scss'
import { createPinia } from 'pinia'
import { createRoot } from '@pkg/cordis'
import { pluginRegistry } from './plugins/core/plugin-registry.ts'
import { RENDERER_SERVICE } from './renderer/vue-renderer.ts'
import { useChatStore } from './stores/chat.ts'
import type { RendererService } from './renderer/vue-renderer.ts'

async function main(): Promise<void> {
  const rootCtx = createRoot()
  window.addEventListener('beforeunload', () => rootCtx.close())

  const pinia = createPinia()
  const chat = useChatStore(pinia)

  rootCtx.on('plugin/error', (payload) => {
    const { id, error } = payload as { id: string; error: unknown }
    chat.appendError(`插件 ${id}：${error instanceof Error ? error.message : String(error)}`)
  })

  // 插件树全部装配完成后 registry 才 resolve，renderer 服务此时必然就绪。
  await rootCtx.use(pluginRegistry)

  const renderer = rootCtx.require<RendererService>(RENDERER_SERVICE)
  renderer.mount((app) => app.use(pinia))
}

void main()
