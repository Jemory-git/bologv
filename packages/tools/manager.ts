/**
 * ToolManager Plugin：统一管理全部工具的生命周期。
 *
 * 职责：
 *   1. 构造 ToolRunContext（llm/fs/shell/tools/pickModel 均 boot 时确定，不随对话变化）。
 *   2. 发现 + 实例化：discoverTools() 返回 ToolFactory 清单，逐个传入 ctx 实例化一次。
 *   3. 动态计算生效状态：enabled/favorite 由「框架约束 + 用户配置」合并，每次读取时计算，
 *      因此 reload(settings) 即可热更新，无需重建工具实例。
 *   4. 对外暴露三个 Service：ToolRegistry（agent-loop 消费，仅启用项）、
 *      ToolCatalog（HTTP 只读，含全部项）、ToolManager（HTTP 热更新）。
 *
 * config 由 boot.ts 注入（保持 plugin 不直接碰文件系统）：
 *   - rootDir：文件类工具的沙箱根
 *   - enableShell：是否暴露 shell 能力
 *   - settings：tools.json 的内容（enabled / favorite）
 *   - getModels：模型配置读取器，供 ctx.pickModel 按请求时点取最新配置
 */

import type { PluginObject } from '@pkg/cordis'
import { LLM_SERVICE_NAME } from '@pkg/models/language/types.ts'
import type { LLMService } from '@pkg/models/language/types.ts'
import type { Vendor } from '@pkg/models/types.ts'
import { discoverTools } from './discover.ts'
import { buildFsApi, buildShellApi } from './factory.ts'
import type {
  ReferenceReaderApi,
  SystemInfo,
  Tool,
  ToolCatalog,
  ToolCatalogItem,
  ToolManager,
  ToolRegistry,
  ToolRunContext,
  ToolSettings,
} from './types.ts'
import {
  TOOLS_CATALOG_SERVICE_NAME,
  TOOLS_MANAGER_SERVICE_NAME,
  TOOLS_SERVICE_NAME,
} from './types.ts'

interface ManagerConfig {
  rootDir?: string
  enableShell?: boolean
  settings?: ToolSettings
  getModels?: () => Promise<Vendor[]>
  referenceReader?: ReferenceReaderApi
  /** 覆盖写保护实现，由组合根注入（读会话事件判断是否已读过某文件）。 */
  hasReadFile?: (absolutePath: string) => Promise<boolean>
  /** 应用自身信息快照，供 get_system_info 使用。 */
  systemInfo?: SystemInfo
}

export const toolManagerPlugin: PluginObject = {
  name: 'tool-manager',
  inject: [LLM_SERVICE_NAME],
  async apply(ctx, rawConfig) {
    const config = (rawConfig ?? {}) as ManagerConfig
    const llm = ctx.require<LLMService>(LLM_SERVICE_NAME)

    // 用户配置（可热更新）；框架约束来自 Tool 定义本身，不在此处。
    let currentSettings: ToolSettings = config.settings ?? {}

    // 生效状态：框架约束优先于用户配置。
    const effectiveEnabled = (t: Tool): boolean =>
      t.disableable === false ? true : (currentSettings[t.name]?.enabled ?? true)
    const effectiveFavorite = (t: Tool): boolean =>
      t.favoriteEditable === false ? (t.fixedFavorite ?? false) : (currentSettings[t.name]?.favorite ?? false)

    // 已发现工具（实例化一次，热更新只改过滤策略）。闭包供 registry/catalog 动态读取。
    const discovered: Tool[] = []

    // 注册表只读视图：仅启用项；供 agent-loop 与 ctx.tools 消费。
    const registry: ToolRegistry = {
      list: () => discovered.filter((t) => effectiveEnabled(t)),
      get: (name) => {
        const t = discovered.find((x) => x.name === name)
        return t && effectiveEnabled(t) ? t : undefined
      },
      isFavorite: (name) => {
        const t = discovered.find((x) => x.name === name)
        return t ? effectiveFavorite(t) : false
      },
    }

    // 构造 ctx（boot 时一次）。tools 视图即 registry；pickModel 按请求时点读最新模型配置。
    const runCtx: ToolRunContext = {
      llm,
      fs: config.rootDir ? buildFsApi(config.rootDir) : undefined,
      shell: config.enableShell === true && config.rootDir !== undefined ? buildShellApi(config.rootDir) : undefined,
      tools: registry,
      pickModel: async (requirement) => {
        const vendors = (await config.getModels?.()) ?? []
        for (const v of vendors) {
          for (const m of v.models) {
            if (m.category === requirement.category && m.inputModalities.includes(requirement.inputModality)) {
              return m.modelId
            }
          }
        }
        return undefined
      },
      referenceReader: config.referenceReader,
      hasReadFile: config.hasReadFile,
      systemInfo: config.systemInfo,
    }

    // 发现 + 实例化。每个工厂拿到同一份 ctx，能力构造时绑定。
    for (const factory of discoverTools()) {
      discovered.push(factory(runCtx))
    }

    const toCatalogItem = (t: Tool): ToolCatalogItem => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
      enabled: effectiveEnabled(t),
      favorite: effectiveFavorite(t),
      disableable: t.disableable !== false,
      favoriteEditable: t.favoriteEditable !== false,
    })

    ctx.provide<ToolRegistry>(TOOLS_SERVICE_NAME, registry)

    // catalog 含全部已发现工具（含禁用项），供 UI 查看与重新启用。
    ctx.provide<ToolCatalog>(TOOLS_CATALOG_SERVICE_NAME, {
      list: () => discovered.map(toCatalogItem),
      get: (name) => {
        const t = discovered.find((x) => x.name === name)
        return t ? toCatalogItem(t) : undefined
      },
    })

    // 热更新：替换用户配置即可，生效状态下次读取时自动重算。
    ctx.provide<ToolManager>(TOOLS_MANAGER_SERVICE_NAME, {
      reload(settings) {
        currentSettings = settings
      },
    })
  },
}
