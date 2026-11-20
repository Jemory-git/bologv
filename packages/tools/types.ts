/**
 * 工具能力接缝的 Service Definition。对应真实仓库 packages/core/tools。
 *
 * 注册表本身不是能力实现，它只是「收集点」；
 * 具体工具由独立插件注册，注册动作本身就是一种可回收的效果。
 */

import type { Disposer } from '@pkg/cordis'

export interface Tool {
  name: string
  description: string
  parameters: Record<string, unknown>
  run(args: Record<string, unknown>): Promise<string> | string
}

export interface ToolRegistry {
  register(tool: Tool): Disposer
  list(): Tool[]
  get(name: string): Tool | undefined
}

export const TOOLS_SERVICE_NAME = 'tools'
