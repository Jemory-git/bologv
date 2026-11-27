/**
 * 插件清单：把「加载哪些能力」变成声明式数据。
 *
 * 增删能力只改这个数组；内核、插件、入口都不需要改动。
 */

import type { Plugin } from '@pkg/cordis'
import type { Vendor } from '@pkg/models/types.ts'
import type { ReferenceReaderApi, SystemInfo, ToolSettings } from '@pkg/tools'
import { agentLoopPlugin, type ImageEmbedResolver, type SystemPromptBuilder } from '@pkg/loop'
import { plugin as languagePlugin } from '@pkg/models/language'
import { checkpointPlugin, sessionManagerPlugin } from '@pkg/session'
import { toolManagerPlugin } from '@pkg/tools'
import { buildSystemPrompt } from './prompts/index.ts'

export interface PluginEntry {
  plugin: Plugin
  config?: Record<string, unknown>
}

/** 装配输入：全部由组合根（boot.ts）提供，插件不自行读配置或环境。 */
export interface ManifestOptions {
  /** 会话根目录（每个会话一个子目录）。 */
  sessionsRoot: string
  /** 文件类工具的沙箱根目录，同时作为模型可见的「工作目录」。 */
  workingDir: string
  /** 厂商配置读取器；provider 按请求时点读取最新配置。 */
  getVendors: () => Promise<Vendor[]>
  /** 图片内嵌解析器；循环不直接触碰文件系统。 */
  resolveImageEmbeds: ImageEmbedResolver
  /** tools.json 内容；boot 时读一次。 */
  toolSettings: ToolSettings
  /** 参考文件读取器（任意绝对路径），供 read_file / understand_image 使用。 */
  referenceReader: ReferenceReaderApi
  /** 覆盖写保护：本会话是否已读过某绝对路径。 */
  hasReadFile: (absolutePath: string) => Promise<boolean>
  /** 应用自身信息快照，供 get_system_info 工具读取。 */
  systemInfo: SystemInfo
}

/**
 * 插件清单。顺序纯属组织便利：加载是并发的，每个插件按 inject 自行等待服务，
 * 因此任意排列都不会改变加载结果。
 */
export function pluginManifest(options: ManifestOptions): PluginEntry[] {
  const { sessionsRoot, workingDir, getVendors, resolveImageEmbeds, toolSettings, referenceReader, hasReadFile, systemInfo } = options

  // 工作目录是 prompt 的动态上下文：在组合根闭合它，loop 与 prompt 模块都不必知道路径从哪来。
  const buildPrompt: SystemPromptBuilder = (input) => buildSystemPrompt({ ...input, workingDir })

  return [
    { plugin: sessionManagerPlugin, config: { sessionsRoot } },
    { plugin: checkpointPlugin },
    { plugin: languagePlugin, config: { getVendors } },
    {
      plugin: toolManagerPlugin,
      config: { rootDir: workingDir, enableShell: true, settings: toolSettings, getModels: getVendors, referenceReader, hasReadFile, systemInfo },
    },
    { plugin: agentLoopPlugin, config: { maxSteps: 6, resolveImageEmbeds, buildSystemPrompt: buildPrompt } },
  ]
}
