/**
 * 插件清单：把「加载哪些能力」变成声明式数据。
 *
 * 增删能力只改这个数组；内核、插件、入口都不需要改动。
 */

import type { Plugin } from '@pkg/cordis'
import type { Vendor } from '@pkg/llm/types.ts'
import type { ReferenceReaderApi, ToolSettings } from '@pkg/tools'
import { agentLoopPlugin, type ImageEmbedResolver } from '@pkg/loop'
import { deepseekLLM } from '@pkg/llm-deepseek'
import { checkpointPlugin, sessionManagerPlugin } from '@pkg/session'
import { toolManagerPlugin } from '@pkg/tools'
import { buildSystemPrompt } from './prompts/index.ts'

export interface PluginEntry {
  plugin: Plugin
  config?: Record<string, unknown>
}

/**
 * 插件清单。顺序纯属组织便利：加载是并发的，每个插件按 inject 自行等待服务，
 * 因此任意排列都不会改变加载结果。
 *
 * @param sessionsRoot      会话目录根（由组合根决定；每个会话一个子目录）。
 * @param getVendors        厂商配置读取器，由组合根注入；provider 按请求时点读取最新配置。
 * @param rootDir           文件类工具的沙箱根目录，由组合根决定。
 * @param resolveImageEmbeds 图片内嵌解析器，由组合根注入；循环不直接触碰文件系统。
 * @param toolSettings      tools.json 内容；boot 时读一次。
 * @param referenceReader   参考文件读取器（任意绝对路径），由组合根注入；供 read_file/understand_image 工具使用。
 * @returns 待加载的插件条目。
 */
export function pluginManifest(
  sessionsRoot: string,
  getVendors: () => Promise<Vendor[]>,
  rootDir: string,
  resolveImageEmbeds: ImageEmbedResolver,
  toolSettings: ToolSettings,
  referenceReader: ReferenceReaderApi,
): PluginEntry[] {
  return [
    { plugin: sessionManagerPlugin, config: { sessionsRoot } },
    { plugin: checkpointPlugin },
    { plugin: deepseekLLM, config: { getVendors } },
    {
      plugin: toolManagerPlugin,
      config: { rootDir, enableShell: true, settings: toolSettings, getModels: getVendors, referenceReader },
    },
    { plugin: agentLoopPlugin, config: { maxSteps: 6, resolveImageEmbeds, buildSystemPrompt } },
  ]
}
