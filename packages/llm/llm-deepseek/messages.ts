/**
 * 消息格式转换：我们的 ChatMessage / ToolSpec → DeepSeek API 格式。
 *
 * 纯文本消息保持字符串；带参考文件的消息展开成 content parts，
 * 图片按 OpenAI 兼容格式转成 data URL。
 */

import type { ChatContentPart, ChatRequest } from '@pkg/llm'
import type { DeepSeekContentPart, DeepSeekMessage } from './types.ts'

export function toDeepSeekMessages(messages: ChatRequest['messages']): DeepSeekMessage[] {
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
    return { role: m.role, content: toDeepSeekContent(m.content) }
  })
}

export function toDeepSeekTools(tools: ChatRequest['tools']) {
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

function toDeepSeekContent(content: string | ChatContentPart[]): string | DeepSeekContentPart[] {
  if (typeof content === 'string') return content
  return content.map((part): DeepSeekContentPart => {
    if (part.type === 'text') return { type: 'text', text: part.text }
    return { type: 'image_url', image_url: { url: `data:${part.mimeType};base64,${part.data}` } }
  })
}
