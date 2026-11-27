/**
 * 语言任务契约：聊天能力接缝的 Service Definition + 推理信封。
 *
 * 这里刻意「只有契约、没有实现」：定义方不关心谁来实现。
 * 纯类型 + 常量，不得引入 node-only 模块（UI 侧也消费这份）。
 */

import type { Protocol } from '../types.ts'

// —— 聊天契约 ——

export interface ToolCall {
  id: string
  name: string
  args: Record<string, unknown>
}

/**
 * 消息内容片段。
 * 文本与图片分开表达，由协议适配器翻译成各家的实际协议；
 * 上层与事件日志都不关心 base64 还是 URL。
 */
export type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; mimeType: string; data: string }

/**
 * 推理信封：厂商返回的、下一轮请求必须原样回传的协议私有状态
 * （如 responses 的 reasoning items、anthropic 的 thinking 块）。
 *
 * 上层不解释 data，只负责持久化与回传；
 * 协议/厂商标签匹配才回传，过滤与盖章单点在分发器（plugin.ts）。
 */
export interface ProviderState {
  /** 产生信封的厂商 id；适配器 decode 时留空串，由分发器盖章。 */
  vendorId: string
  protocol: Protocol
  /** 协议私有数据，原样持久化、原样回传。 */
  data: unknown
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  /** 纯文本用 string 表达；带参考文件时使用多段内容。 */
  content: string | ChatContentPart[]
  /** assistant 消息携带的工具调用；tool 结果消息通过 toolCallId 与之配对。 */
  toolCalls?: ToolCall[]
  toolName?: string
  toolCallId?: string
  /** assistant 消息携带的推理信封；投影原样带给适配器。 */
  providerState?: ProviderState
}

export interface ToolSpec {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface ChatRequest {
  messages: ChatMessage[]
  tools: ToolSpec[]
  /** 模型名，由调用方决定；分发器在最新配置中找不到时报错。 */
  model: string
}

export type LLMResult =
  | { kind: 'text'; text: string; providerState?: ProviderState }
  | { kind: 'tool_calls'; calls: ToolCall[]; providerState?: ProviderState }

/** 聊天能力唯一需要实现的接口。 */
export interface LLMService {
  chat(request: ChatRequest): Promise<LLMResult>
}

export const LLM_SERVICE_NAME = 'llm'
