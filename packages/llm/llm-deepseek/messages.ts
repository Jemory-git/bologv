/**
 * 消息格式转换：我们的 ChatMessage / ToolSpec → DeepSeek API 格式。
 */

import type { ChatRequest } from '@pkg/llm'
import type { DeepSeekMessage } from './types.ts'

export function toDeepSeekMessages(messages: ChatRequest['messages']): DeepSeekMessage[] {
  return messages.map((m) => {
    if (m.role === 'tool') {
      return { role: 'tool', content: m.content, tool_call_id: m.toolCallId ?? '' }
    }
    if (m.toolCalls !== undefined && m.toolCalls.length > 0) {
      return {
        role: m.role,
        content: m.content,
        tool_calls: m.toolCalls.map((call) => ({
          id: call.id,
          type: 'function' as const,
          function: { name: call.name, arguments: JSON.stringify(call.args) },
        })),
      }
    }
    return { role: m.role, content: m.content }
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
