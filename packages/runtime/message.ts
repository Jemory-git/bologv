/**
 * 把事件日志投影成模型请求消息。对应真实仓库 packages/session/session-projection。
 *
 * 投影是纯函数：同一份日志永远算出同一串消息，因此压缩、裁剪、换 provider
 * 都只改这里，历史事实一条不动。这是「模型可见 ⟺ 已记录」的后半句。
 */

import type { ChatMessage } from '@pkg/llm'
import type { SessionEvent } from '@pkg/session'

export function toChatMessages(events: readonly SessionEvent[]): ChatMessage[] {
  const messages: ChatMessage[] = []
  for (const event of events) {
    switch (event.type) {
      case 'user/message':
        messages.push({ role: 'user', content: event.text })
        break
      case 'assistant/message':
        messages.push({ role: 'assistant', content: event.text })
        break
      case 'tool/call': {
        // 同一轮的连续调用合并为一条 assistant 消息，
        // 对应 provider 协议里 assistant.tool_calls 数组。
        const call = { id: event.callId, name: event.name, args: event.args }
        const last = messages.at(-1)
        if (last?.role === 'assistant' && last.toolCalls !== undefined) {
          last.toolCalls.push(call)
        } else {
          messages.push({ role: 'assistant', content: '', toolCalls: [call] })
        }
        break
      }
      case 'tool/result':
        messages.push({
          role: 'tool',
          content: event.content,
          toolName: event.name,
          toolCallId: event.callId,
        })
        break
      default:
        assertNever(event)
    }
  }
  return messages
}

function assertNever(value: never): never {
  throw new Error(`unhandled session event: ${JSON.stringify(value)}`)
}
