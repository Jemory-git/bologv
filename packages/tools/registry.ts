/**
 * 工具注册表的实现。对应真实仓库 packages/core/tools。
 *
 * 注册即效果：每个工具登记时同步登记一个回收动作，
 * 插件卸载时工具自动消失，不需要任何反向登记表。
 */

import type { PluginObject } from '@pkg/cordis'
import { TOOLS_SERVICE_NAME, type Tool, type ToolRegistry } from './types.ts'

export const toolsPlugin: PluginObject = {
  name: 'tools',
  apply(ctx) {
    const tools = new Map<string, Tool>()

    ctx.provide<ToolRegistry>(TOOLS_SERVICE_NAME, {
      register(tool) {
        if (tools.has(tool.name)) throw new Error(`tool "${tool.name}" already registered`)
        tools.set(tool.name, tool)
        return ctx.effect(() => {
          // 身份守卫：只删本次注册的工具，避免误删同名重新注册的后来者。
          if (tools.get(tool.name) === tool) tools.delete(tool.name)
        })
      },
      list() {
        return [...tools.values()]
      },
      get(name) {
        return tools.get(name)
      },
    })
  },
}
