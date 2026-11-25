/**
 * DeepSeek API 的内部类型。
 * 这些类型只在 provider 内部使用，不暴露给上层（上层依赖 @llm/types.ts 的契约）。
 */

export interface DeepSeekToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

/** OpenAI 兼容的多段内容：图片以 data URL 传递。 */
export type DeepSeekContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | DeepSeekContentPart[]
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
