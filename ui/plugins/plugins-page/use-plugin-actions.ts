/**
 * 插件启停交互：给按钮提供防重复点击的 busy 状态。
 *
 * busy 是模块级单例 —— 切换 tab 会卸载列表组件，但操作中的插件在任意视图里都应保持禁用；
 * 真正的并发保护在 registry（pending 集合），这里只负责视觉反馈与顺手拦截。
 */
import type { PluginRegistryService } from '@ui/plugins/core/plugin-registry.ts'
import { shallowReactive } from 'vue'
import { PLUGIN_REGISTRY_SERVICE } from '@ui/plugins/core/plugin-registry.ts'
import { useService } from '@ui/use/ctx-service.ts'

//states
const busy = shallowReactive(new Set<string>())

export function usePluginActions() {
  //states
  const registry = useService<PluginRegistryService>(PLUGIN_REGISTRY_SERVICE)

  //methods
  async function run(id: string, action: () => Promise<void>): Promise<void> {
    if (busy.has(id)) return
    busy.add(id)
    try {
      await action()
    } finally {
      busy.delete(id)
    }
  }

  return {
    busy,
    toggle: (id: string) => run(id, () => registry.toggle(id)),
    reload: (id: string) => run(id, () => registry.reload(id)),
  }
}
