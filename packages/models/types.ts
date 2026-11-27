/**
 * 模型配置契约：settings/models.json 的共享形状。
 * 组合根、settings 存储、HTTP DTO、UI 配置面板都消费这份定义。
 *
 * 聊天能力的 Service Definition 在 language/types.ts（按任务子目录拆分）。
 */

// —— 协议 ——

/** 模型 API 的参数协议阵营；决定请求/响应如何翻译（language/protocols/）。 */
export const PROTOCOLS = ['openai-chat', 'openai-responses', 'anthropic'] as const
export type Protocol = (typeof PROTOCOLS)[number]

export function isProtocol(value: unknown): value is Protocol {
  return typeof value === 'string' && PROTOCOLS.includes(value as Protocol)
}

// —— 类别与模态 ——

/**
 * 模型用途类别。
 *
 * - language：对话与理解（chat completions），可带 image/audio 等多模态**输入**；
 * - image / audio / video：对应模态的**生成**模型（如 /images/generations）。
 *
 * 「理解图片」需要的是 language + image 输入，不是 image 类别——按 category 取模型时
 * 必须同时约束输入模态，否则会把生成模型当理解模型用。
 */
export const MODEL_CATEGORIES = ['language', 'image', 'audio', 'video'] as const
export type ModelCategory = (typeof MODEL_CATEGORIES)[number]

export const MODALITIES = ['text', 'image', 'audio', 'video'] as const
export type Modality = (typeof MODALITIES)[number]

export function isModelCategory(value: unknown): value is ModelCategory {
  return typeof value === 'string' && MODEL_CATEGORIES.includes(value as ModelCategory)
}

export function isModality(value: unknown): value is Modality {
  return typeof value === 'string' && MODALITIES.includes(value as Modality)
}

// —— 配置形状 ——

export interface ModelDef {
  id: string
  modelId: string    // API 模型标识，如 "deepseek-chat"
  path: string       // endpoint path，如 "/chat/completions"
  /** 该模型 API 的参数协议；必填，无缺省回退。同一厂商下不同模型可走不同协议（chat / responses）。 */
  protocol: Protocol
  /** 主要任务类别，由用户显式指定。 */
  category: ModelCategory
  /** 模型允许接收的输入模态；多项即支持多模态输入。 */
  inputModalities: Modality[]
}

export interface Vendor {
  id: string
  name: string
  baseURL: string
  /** 环境变量名（不是值），如 "DEEPSEEK_API_KEY"。运行时通过 process.env[apiKeyEnv] 解析。 */
  apiKeyEnv: string
  models: ModelDef[]
}
