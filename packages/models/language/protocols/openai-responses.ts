/**
 * OpenAI Responses 协议适配器（Ark /responses 等端点）。
 *
 * 无状态姿态：store:false、每轮全量 input、不用 previous_response_id、不用内置工具。
 * system → 顶层 instructions；tools 平铺 function（strict:false 显式，responses 默认 strict）。
 * reasoning items 原样打包信封；下一轮 encode 时原样展开置于该 assistant items 之前。
 * 依据：documents/bytedance/response.md。
 */

import { LLMResponseError } from '@pkg/models'
import type { ChatContentPart, ChatMessage, ChatRequest, LLMResult, ToolCall } from '../types.ts'
import type { ProtocolAdapter } from './types.ts'

// —— 协议内部类型（不暴露给上层）——

/** input 元素异构（message / function_call / function_call_output / reasoning 回传），统一用宽形状。 */
type InputItem = Record<string, unknown>

interface ResponsesOutputItem {
  type?: string
  /** message：内容片段列表。 */
  content?: Array<{ type?: string; text?: string }>
  /** function_call：调用标识 / 函数名 / 参数 JSON 字符串。 */
  call_id?: string
  name?: string
  arguments?: string
}

interface ResponsesResponse {
  output?: ResponsesOutputItem[]
}

// —— 适配器 ——

export const openaiResponses: ProtocolAdapter = {
  headers(apiKey) {
    return { Authorization: `Bearer ${apiKey}` }
  },

  encode(request, modelId) {
    const instructions = request.messages
      .filter((m) => m.role === 'system')
      .map((m) => toPlainText(m.content))
      .filter((text) => text !== '')
      .join('\n\n')

    const input: InputItem[] = []
    for (const m of request.messages) {
      if (m.role === 'system') continue

      if (m.role === 'tool') {
        input.push({ type: 'function_call_output', call_id: m.toolCallId ?? '', output: toPlainText(m.content) })
        continue
      }
      if (m.role === 'user') {
        input.push({ type: 'message', role: 'user', content: toInputContent(m.content) })
        continue
      }

      // assistant：信封 reasoning items 原样展开，置于该 assistant items 之前。
      input.push(...envelopeItems(m))
      const text = toPlainText(m.content)
      if (text !== '') {
        // assistant + output_text 必须显式声明 type:'message'（文档 632 行）。
        input.push({ type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] })
      }
      for (const call of m.toolCalls ?? []) {
        input.push({ type: 'function_call', call_id: call.id, name: call.name, arguments: JSON.stringify(call.args) })
      }
    }

    return {
      model: modelId,
      input,
      instructions: instructions === '' ? undefined : instructions,
      tools: request.tools.length > 0
        ? request.tools.map((t) => ({
            type: 'function',
            name: t.name,
            description: t.description,
            parameters: t.parameters,
            strict: false,
          }))
        : undefined,
      store: false,
    }
  },

  decode(raw) {
    const output = (raw as ResponsesResponse | undefined)?.output
    if (!Array.isArray(output)) throw new LLMResponseError('openai-responses: 响应缺少 output 数组')

    const calls: ToolCall[] = []
    const texts: string[] = []
    const reasoning: unknown[] = []
    for (const item of output) {
      if (item?.type === 'function_call') {
        if (typeof item.call_id !== 'string' || typeof item.name !== 'string') {
          throw new LLMResponseError('openai-responses: function_call 缺少 call_id 或 name')
        }
        calls.push({ id: item.call_id, name: item.name, args: parseArgs(item.arguments, item.name) })
      } else if (item?.type === 'message') {
        for (const part of item.content ?? []) {
          if (part?.type === 'output_text' && typeof part.text === 'string') texts.push(part.text)
        }
      } else if (item?.type === 'reasoning') {
        reasoning.push(item)
      }
    }

    // vendorId 空串占位，由分发器盖章。
    const providerState = reasoning.length > 0
      ? { vendorId: '', protocol: 'openai-responses' as const, data: reasoning }
      : undefined

    if (calls.length > 0) {
      return { kind: 'tool_calls', calls, ...(providerState !== undefined ? { providerState } : {}) }
    }
    if (texts.length === 0) throw new LLMResponseError('openai-responses: 响应没有 message 或 function_call 输出')
    return { kind: 'text', text: texts.join(''), ...(providerState !== undefined ? { providerState } : {}) }
  },
}

// —— encode 辅助 ——

/** 信封 data 即 reasoning items 数组，原样回传。 */
function envelopeItems(m: ChatMessage): InputItem[] {
  const data = m.providerState?.data
  return Array.isArray(data) ? (data as InputItem[]) : []
}

function toInputContent(content: string | ChatContentPart[]): string | InputItem[] {
  if (typeof content === 'string') return content
  return content.map((part): InputItem => {
    if (part.type === 'text') return { type: 'input_text', text: part.text }
    return { type: 'input_image', image_url: `data:${part.mimeType};base64,${part.data}` }
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

// —— decode 辅助 ——

/** 工具参数必须是 JSON 对象字符串；解析失败或形状不符都转成域错误。 */
function parseArgs(raw: unknown, toolName: string): Record<string, unknown> {
  if (typeof raw !== 'string') {
    throw new LLMResponseError(`openai-responses: 工具 "${toolName}" 的 arguments 不是字符串`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new LLMResponseError(`openai-responses: 工具 "${toolName}" 的 arguments 不是合法 JSON`)
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new LLMResponseError(`openai-responses: 工具 "${toolName}" 的 arguments 必须是 JSON 对象`)
  }
  return parsed as Record<string, unknown>
}
