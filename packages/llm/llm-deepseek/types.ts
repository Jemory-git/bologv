/**
 * DeepSeek API 的内部类型。
 * 这些类型只在 provider 内部使用，不暴露给上层（上层依赖 @llm/types.ts 的契约）。
 */

export interface DeepSeekToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: DeepSeekToolCall[]
  tool_call_id?: string
}

export interface DeepSeekResponse {
  choices: Array<{
    message: {
      content: string | null
      tool_calls?: DeepSeekToolCall[]
    }
  }>
}
