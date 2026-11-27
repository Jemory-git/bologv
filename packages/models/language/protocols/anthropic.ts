/**
 * Anthropic Messages 协议适配器。
 *
 * 认证：x-api-key + anthropic-version；system 顶层；tools 用 input_schema；
 * 工具调用/结果用 tool_use / tool_result 块；图片用 base64 source 块。
 * max_tokens 为该 API 必填，取协议层常量。
 * thinking 块原样打包信封；encode 时原样置于 assistant content 块最前。
 */

import { LLMResponseError } from '@pkg/models'
import type { ChatContentPart, ChatMessage, ChatRequest, LLMResult, ToolCall } from '../types.ts'
import type { ProtocolAdapter } from './types.ts'

// —— 协议层常量 ——

const MAX_TOKENS = 8192
const ANTHROPIC_VERSION = '2023-06-01'

// —— 协议内部类型（不暴露给上层）——

/** content 块异构（text / image / tool_use / tool_result / thinking 回传），统一用宽形状。 */
type Block = Record<string, unknown>

interface AnthropicResponseBlock {
  type?: string
  text?: string
  id?: string
  name?: string
  input?: unknown
}

interface AnthropicResponse {
  content?: AnthropicResponseBlock[]
}

// —— 适配器 ——

export const anthropic: ProtocolAdapter = {
  headers(apiKey) {
    return { 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION }
  },

  encode(request, modelId) {
    const system = request.messages
      .filter((m) => m.role === 'system')
      .map((m) => toPlainText(m.content))
      .filter((text) => text !== '')
      .join('\n\n')

    const messages: Array<{ role: 'user' | 'assistant'; content: string | Block[] }> = []
    for (const m of request.messages) {
      if (m.role === 'system') continue

      if (m.role === 'tool') {
        messages.push({
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: m.toolCallId ?? '', content: toPlainText(m.content) }],
        })
        continue
      }
      if (m.role === 'user') {
        messages.push({ role: 'user', content: toUserContent(m.content) })
        continue
      }

      // assistant：信封 thinking 块原样回传，置于 content 最前，随后文本与 tool_use。
      const blocks: Block[] = [...envelopeBlocks(m)]
      const text = toPlainText(m.content)
      if (text !== '') blocks.push({ type: 'text', text })
      for (const call of m.toolCalls ?? []) {
        blocks.push({ type: 'tool_use', id: call.id, name: call.name, input: call.args })
      }
      if (blocks.length > 0) messages.push({ role: 'assistant', content: blocks })
    }

    return {
      model: modelId,
      max_tokens: MAX_TOKENS,
      system: system === '' ? undefined : system,
      messages,
      tools: request.tools.length > 0
        ? request.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }))
        : undefined,
    }
  },

  decode(raw) {
    const content = (raw as AnthropicResponse | undefined)?.content
    if (!Array.isArray(content)) throw new LLMResponseError('anthropic: 响应缺少 content 数组')

    const calls: ToolCall[] = []
    const texts: string[] = []
    const thinking: unknown[] = []
    for (const block of content) {
      if (block?.type === 'tool_use') {
        if (typeof block.id !== 'string' || typeof block.name !== 'string') {
          throw new LLMResponseError('anthropic: tool_use 缺少 id 或 name')
        }
        if (typeof block.input !== 'object' || block.input === null || Array.isArray(block.input)) {
          throw new LLMResponseError(`anthropic: 工具 "${block.name}" 的 input 必须是 JSON 对象`)
        }
        calls.push({ id: block.id, name: block.name, args: block.input as Record<string, unknown> })
      } else if (block?.type === 'text' && typeof block.text === 'string') {
        texts.push(block.text)
      } else if (block?.type === 'thinking') {
        thinking.push(block)
      }
    }

    // vendorId 空串占位，由分发器盖章。
    const providerState = thinking.length > 0
      ? { vendorId: '', protocol: 'anthropic' as const, data: thinking }
      : undefined

    if (calls.length > 0) {
      return { kind: 'tool_calls', calls, ...(providerState !== undefined ? { providerState } : {}) }
    }
    return { kind: 'text', text: texts.join(''), ...(providerState !== undefined ? { providerState } : {}) }
  },
}

// —— encode 辅助 ——

/** 信封 data 即 thinking 块数组，原样回传。 */
function envelopeBlocks(m: ChatMessage): Block[] {
  const data = m.providerState?.data
  return Array.isArray(data) ? (data as Block[]) : []
}

function toUserContent(content: string | ChatContentPart[]): string | Block[] {
  if (typeof content === 'string') return content
  return content.map((part): Block => {
    if (part.type === 'text') return { type: 'text', text: part.text }
    return { type: 'image', source: { type: 'base64', media_type: part.mimeType, data: part.data } }
  })
}

/** assistant 历史与工具结果只回传文本。 */
function toPlainText(content: string | ChatContentPart[]): string {
  if (typeof content === 'string') return content
  return content
    .filter((part): part is Extract<ChatContentPart, { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
}
