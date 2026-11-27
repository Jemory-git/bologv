/**
 * OpenAI Chat Completions 协议适配器（DeepSeek 等兼容端点通用）。
 *
 * encode：messages/tools 翻译 + model + stream:false；
 * decode：choices[0].message → LLMResult，arguments 必须是 JSON 对象。
 * 本协议不产生推理信封（providerState）。
 */

import { LLMResponseError } from '@pkg/models'
import type { ChatContentPart, ChatRequest, LLMResult } from '../types.ts'
import type { ProtocolAdapter } from './types.ts'

// —— 协议内部类型（不暴露给上层）——

interface OpenAIChatToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

/** 多段内容：图片以 data URL 传递。 */
type OpenAIChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | OpenAIChatContentPart[]
  tool_calls?: OpenAIChatToolCall[]
  tool_call_id?: string
}

interface OpenAIChatResponse {
  choices: Array<{
    message: {
      content: string | null
      tool_calls?: OpenAIChatToolCall[]
    }
  }>
}

// —— 适配器 ——

export const openaiChat: ProtocolAdapter = {
  headers(apiKey) {
    return { Authorization: `Bearer ${apiKey}` }
  },

  encode(request, modelId) {
    return {
      model: modelId,
      messages: toMessages(request.messages),
      tools: request.tools.length > 0 ? toTools(request.tools) : undefined,
      stream: false,
    }
  },

  decode(raw) {
    const msg = (raw as OpenAIChatResponse | undefined)?.choices?.[0]?.message
    if (msg === undefined) throw new LLMResponseError('openai-chat: 响应缺少 choices[0].message')

    if (msg.tool_calls !== undefined && msg.tool_calls.length > 0) {
      return {
        kind: 'tool_calls',
        calls: msg.tool_calls.map((tc) => {
          const name = tc.function?.name
          if (typeof tc.id !== 'string' || typeof name !== 'string') {
            throw new LLMResponseError('openai-chat: tool_call 缺少 id 或 function.name')
          }
          return { id: tc.id, name, args: parseArgs(tc.function.arguments, name) }
        }),
      }
    }

    return { kind: 'text', text: msg.content ?? '' }
  },
}

// —— encode 辅助 ——

function toMessages(messages: ChatRequest['messages']): OpenAIChatMessage[] {
  return messages.map((m) => {
    if (m.role === 'tool') {
      return { role: 'tool', content: toPlainText(m.content), tool_call_id: m.toolCallId ?? '' }
    }
    if (m.toolCalls !== undefined && m.toolCalls.length > 0) {
      return {
        role: m.role,
        content: toPlainText(m.content),
        tool_calls: m.toolCalls.map((call) => ({
          id: call.id,
          type: 'function' as const,
          function: { name: call.name, arguments: JSON.stringify(call.args) },
        })),
      }
    }
    return { role: m.role, content: toContent(m.content) }
  })
}

function toTools(tools: ChatRequest['tools']) {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }))
}

/** 工具结果与 assistant 工具调用只接受字符串内容。 */
function toPlainText(content: string | ChatContentPart[]): string {
  if (typeof content === 'string') return content
  return content
    .filter((part): part is Extract<ChatContentPart, { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
}

function toContent(content: string | ChatContentPart[]): string | OpenAIChatContentPart[] {
  if (typeof content === 'string') return content
  return content.map((part): OpenAIChatContentPart => {
    if (part.type === 'text') return { type: 'text', text: part.text }
    return { type: 'image_url', image_url: { url: `data:${part.mimeType};base64,${part.data}` } }
  })
}

// —— decode 辅助 ——

/** 工具参数必须是 JSON 对象；解析失败或形状不符都转成域错误。 */
function parseArgs(raw: string, toolName: string): Record<string, unknown> {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new LLMResponseError(`openai-chat: 工具 "${toolName}" 的 arguments 不是合法 JSON`)
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new LLMResponseError(`openai-chat: 工具 "${toolName}" 的 arguments 必须是 JSON 对象`)
  }
  return parsed as Record<string, unknown>
}
