/**
 * 工具域契约：Tool 定义 + 运行时上下文 + ToolManager 对外 Service。
 *
 * 工具本身是纯对象（不是 Cordis plugin），由 ToolManager plugin 统一发现、过滤、装配运行时能力。
 * 新增一个 tool = 在 impl/ 下加文件导出 Tool 对象 + discover.ts 清单加一行。
 */

import type { LLMService } from '@pkg/models/language/types.ts'
import type { ModelCategory, Modality } from '@pkg/models/types.ts'
import type { ReferenceMeta } from '@pkg/session/references.ts'

// —— 运行时能力接口 ——

/** 文件系统工具能力（受沙箱约束，只暴露安全操作）。 */
export interface ToolFsApi {
  /** 沙箱根目录绝对路径。readText/writeText 等接受相对路径。 */
  rootDir: string
  /** 读取完整文本内容；超过大小上限抛错。字符截断由工具按自身展示预算处理，能力层不截断。 */
  readText(relPath: string): Promise<string>
  /** 读取文件为 base64（附带 MIME），用于图片类 tool 喂给多模态模型。 */
  readAsBase64(relPath: string): Promise<{ mime: string; data: string }>
  /** 写入文本文件；目录不存在时自动创建。 */
  writeText(relPath: string, content: string): Promise<void>
  /** 列出目录下的条目。 */
  listDir(relPath: string): Promise<{ name: string; isDir: boolean }[]>
  /** 文件/目录元信息。 */
  stat(relPath: string): Promise<{ size: number; isDir: boolean; modified: number }>
}

/** Shell 执行结果：只表达「命令跑起来了，结果如何」。进程未启动请抛错，不在此伪装成失败退出。 */
export interface ShellResult {
  stdout: string
  stderr: string
  exitCode: number
}

/** Shell 工具能力（超时限制 + 输出截断）。 */
export interface ToolShellApi {
  /** 以 shell 解释整条命令（支持管道、重定向、&&）；超时终止复用退出码语义。 */
  exec(command: string, options?: { timeoutMs?: number }): Promise<ShellResult>
}

// —— 应用自身信息 ——

/**
 * 应用自身的只读信息快照（boot 时确定），供 get_system_info 工具消费。
 * 与 fs / shell 能力无关：这些路径只用于「告诉用户在哪」，不授予任何读写权限。
 */
export interface SystemInfo {
  appVersion: string
  /** 应用安装目录；开发态为项目根。 */
  installDir: string
  /** 配置目录（models / tools / system 等 JSON）。 */
  settingsDir: string
  /** 会话日志目录。 */
  sessionsDir: string
  /** 文件工具沙箱根，同时是 shell 的工作目录。 */
  workingDir: string
  platform: string
  arch: string
  electronVersion: string
  nodeVersion: string
}

// —— Tool 运行时上下文 ——

/**
 * 统一包含所有可能的能力字段；未配置的为 undefined。
 * 所有能力在 boot 时确定，不随对话变化 —— 由 ToolManager 构造一次，注入给每个 ToolFactory。
 */
/** 参考文件读取能力：读任意绝对路径（复用 references 校验规则），不受工具 fs 沙箱约束。 */
export interface ReferenceReaderApi {
  /** 检查路径返回元信息；无效/不支持抛错。 */
  inspect(path: string): Promise<ReferenceMeta>
  /** 读文本；缺失或非文本返回 null。 */
  readText(path: string): Promise<string | null>
  /** 读图片字节（base64 + mime）；缺失返回 null。 */
  readImage2B64(path: string): Promise<{ mime: string; data: string } | null>
}

/**
 * 模型需求：调用方声明「要什么能力」，不关心最终是哪个模型。
 *
 * 类别与输入模态缺一不可：
 *   - category 区分用途——language 可对话/理解，image/audio/video 是对应模态的生成模型；
 *   - inputModality 排除看不见/听不到的模型——同为 language，文本模型读不了图。
 * 例：理解图片 = { category: 'language', inputModality: 'image' }；只按 category 会误取生成模型。
 */
export interface ModelRequirement {
  category: ModelCategory
  inputModality: Modality
}

export interface ToolRunContext {
  /** LLM 服务引用 —— tool 内部需要调模型时直接用。 */
  llm: LLMService
  /** 文件系统能力；未配置 rootDir 时为 undefined。 */
  fs?: ToolFsApi
  /** Shell 能力；未启用时为 undefined。 */
  shell?: ToolShellApi
  /** 工具注册表只读视图 —— 供 query_capabilities 等元工具枚举可用能力。 */
  tools: ToolRegistry
  /** 按需求挑选一个可用模型的 modelId（读取最新模型配置）；无匹配返回 undefined。 */
  pickModel(requirement: ModelRequirement): Promise<string | undefined>
  /** 参考文件读取能力（任意绝对路径）；未注入时为 undefined。 */
  referenceReader?: ReferenceReaderApi
  /**
   * 覆盖写保护：本会话是否已通过 read_file 成功读过该绝对路径。
   * 记录来自会话事件日志，由组合根注入；未注入时不启用保护。
   */
  hasReadFile?: (absolutePath: string) => Promise<boolean>
  /** 应用自身信息；未注入时为 undefined。 */
  systemInfo?: SystemInfo
}

// —— Tool 定义 ——

/** 单个工具的完整定义。纯对象，不是 Cordis plugin。 */
export interface Tool {
  /** 全局唯一标识；LLM 通过此名发起调用。 */
  name: string
  /** 自然语言描述，写给 LLM 看 —— LLM 基于此判断是否需要调这个工具。 */
  description: string
  /** JSON Schema，描述 args 的形状；LLM 按此生成参数。 */
  parameters: Record<string, unknown>
  /** 用户能否禁用此工具；false = 框架级工具，始终启用。默认 true。 */
  disableable?: boolean
  /** 用户能否修改 favorite；false = favorite 由框架固定（见 fixedFavorite）。默认 true。 */
  favoriteEditable?: boolean
  /** favoriteEditable=false 时固定的 favorite 值。默认 false。 */
  fixedFavorite?: boolean
  /** 执行工具逻辑。能力已在工厂构造时注入，run 只收 args。返回纯文本或 {content, data}。 */
  run(args: Record<string, unknown>): Promise<string | ToolResult> | string | ToolResult
}

/** 工具结果：模型可见文本 + 可选结构化副产物。 */
export interface ToolResult {
  /** 模型可见的文本结果。 */
  content: string
  /** 机器可读的结构化副产物（供 loop/投影消费）；自由形状，各工具自定义键。 */
  data?: Record<string, unknown>
}

/**
 * Tool 定义是一个工厂函数：注册时由 ToolManager 传入 ctx（能力），返回可执行 Tool。
 * 能力在构造时绑定（依赖注入），agent-loop 调用 run 时无需再传 ctx。
 */
export type ToolFactory = (ctx: ToolRunContext) => Tool

// —— ToolManager 对外 Service ——

/** ToolManager 提供给 agent-loop 的注册表视图。 */
export interface ToolRegistry {
  /** 返回所有 active（enabled=true）工具，按 discover 顺序。 */
  list(): Tool[]
  /** 按名查找；不存在返回 undefined。 */
  get(name: string): Tool | undefined
  /** 查询某个工具是否被用户标记为 favorite。 */
  isFavorite(name: string): boolean
}

/** ToolManager 提供给 HTTP API 的只读 catalog 视图（含全部已发现工具，不论启用与否）。 */
export interface ToolCatalogItem {
  name: string
  description: string
  parameters: Record<string, unknown>
  /** 生效的启用状态（框架约束 + 用户配置合并后）。 */
  enabled: boolean
  /** 生效的 favorite（框架约束 + 用户配置合并后）。 */
  favorite: boolean
  /** 用户能否禁用。 */
  disableable: boolean
  /** 用户能否修改 favorite。 */
  favoriteEditable: boolean
}

export interface ToolCatalog {
  /** 返回所有已发现工具的 catalog 条目（含禁用项，供 UI 重新启用）。 */
  list(): ToolCatalogItem[]
  /** 按名查找；不存在返回 undefined。 */
  get(name: string): ToolCatalogItem | undefined
}

/** ToolManager 管理接口：供 HTTP 层热更新用户配置。 */
export interface ToolManager {
  /** 应用新的用户配置；框架级约束（disableable/favoriteEditable/fixedFavorite）不受影响。 */
  reload(settings: ToolSettings): void
}

export const TOOLS_SERVICE_NAME = 'tools'
export const TOOLS_CATALOG_SERVICE_NAME = 'toolsCatalog'
export const TOOLS_MANAGER_SERVICE_NAME = 'toolsManager'

/** 目录浏览元工具名。 */
export const QUERY_CAPABILITIES_TOOL_NAME = 'query_capabilities'

/** tool/result.data 中「本会话激活的工具名数组」的约定键；发现投影据此识别。 */
export const DISCOVERED_TOOLS_DATA_KEY = 'discoveredTools'

// —— tools.json 配置形状 ——

/** 单个工具的持久化配置。 */
export interface ToolSettingsEntry {
  enabled: boolean
  favorite: boolean
}

export type ToolSettings = Record<string, ToolSettingsEntry>
