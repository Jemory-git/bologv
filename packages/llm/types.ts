/**
 * LLM 域契约：聊天能力接缝的 Service Definition + 模型配置类型。
 * 对应真实仓库 packages/llm/llm。
 *
 * 这里刻意「只有契约、没有实现」：定义方不关心谁来实现。
 * 换成真模型时，只需要新增一个 provider，消费方（agent-loop）一行不改。
 */

// —— 聊天契约 ——

export interface ToolCall {
  id: string
  name: string
  args: Record<string, unknown>
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  /** assistant 消息携带的工具调用；tool 结果消息通过 toolCallId 与之配对。 */
  toolCalls?: ToolCall[]
  toolName?: string
  toolCallId?: string
}

export interface ToolSpec {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface ChatRequest {
  messages: ChatMessage[]
  tools: ToolSpec[]
  /** 模型名，由调用方决定；provider 在最新配置中找不到时报错。 */
  model: string
}

export type LLMResult =
  | { kind: 'text'; text: string }
  | { kind: 'tool_calls'; calls: ToolCall[] }

/** Provider 侧唯一需要实现的接口。 */
export interface LLMService {
  chat(request: ChatRequest): Promise<LLMResult>
}

export const LLM_SERVICE_NAME = 'llm'

// —— 模型配置（settings/models.json 的共享形状）——
// 组合根、settings 存储、HTTP DTO、UI 配置面板都消费这份定义。

export interface ModelDef {
  id: string
  modelId: string    // API 模型标识，如 "deepseek-chat"
  path: string       // endpoint path，如 "/chat/completions"
}

export interface Vendor {
  id: string
  name: string
  baseURL: string
  /** 环境变量名（不是值），如 "DEEPSEEK_API_KEY"。运行时通过 process.env[apiKeyEnv] 解析。 */
  apiKeyEnv: string
  models: ModelDef[]
}
