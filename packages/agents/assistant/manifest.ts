/**
 * 插件清单：把「加载哪些能力」变成声明式数据，而不是散落在入口的语句。
 * 对应真实仓库的 cordis.patch.yml。
 *
 * 增删能力只改这个数组；内核、插件、入口都不需要改动。
 */

import type { Plugin } from '@pkg/cordis'
import type { SessionStore } from '@pkg/session'
import type { Vendor } from '@pkg/llm/types.ts'
import { agentLoopPlugin } from '@pkg/runtime'
import { deepseekLLM } from '@pkg/llm-deepseek'
import { checkpointPlugin, sessionPlugin } from '@pkg/session'
import { builtinToolsPlugin, toolsPlugin } from '@pkg/tools'

export interface PluginEntry {
  plugin: Plugin
  config?: Record<string, unknown>
}

/**
 * 按依赖需要组织清单；顺序不影响加载结果，未就绪的插件会等待服务出现。
 *
 * @param store   会话存储实现，由组合根注入。
 * @param getVendors 厂商配置读取器，由组合根注入；provider 按请求时点读取最新配置。
 * @param rootDir 文件类工具的沙箱根目录，由组合根决定。
 * @returns 待加载的插件条目。
 */
export function pluginManifest(store: SessionStore, getVendors: () => Promise<Vendor[]>, rootDir: string): PluginEntry[] {
  return [
    { plugin: sessionPlugin(store) },
    { plugin: checkpointPlugin },
    { plugin: deepseekLLM, config: { getVendors } },
    { plugin: toolsPlugin },
    { plugin: builtinToolsPlugin, config: { rootDir } },
    { plugin: agentLoopPlugin, config: { maxSteps: 6 } },
  ]
}
