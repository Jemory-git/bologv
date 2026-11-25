/**
 * 把事件日志投影成模型请求消息。对应真实仓库 packages/session/session-projection。
 *
 * 投影是纯函数：同一份日志 + 同一份引用解析结果，永远算出同一串消息，
 * 因此压缩、裁剪、换 provider 都只改这里，历史事实一条不动。
 * 这是「模型可见 ⟺ 已记录」的后半句。
 */

import type { ChatContentPart, ChatMessage } from '@pkg/llm'
import { referenceLabels } from '@pkg/session'
import type { ReferenceMeta, SessionEvent } from '@pkg/session'

/** 引用路径 → 模型可见内容片段；不支持或读取失败的引用由调用方给出说明文本。 */
export type ReferenceParts = ReadonlyMap<string, ChatContentPart>

export function toChatMessages(events: readonly SessionEvent[], parts: ReferenceParts = new Map()): ChatMessage[] {
  const messages: ChatMessage[] = []
  for (const event of events) {
    switch (event.type) {
      case 'user/message':
        messages.push({ role: 'user', content: toUserContent(event.text, event.references, parts) })
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

/**
 * 有引用时把文本与引用拼成多段内容；没有引用时保持纯字符串。
 *
 * 每个引用前插入一条模型可见的标记：
 *   【参考文件 #2：图片 1「cat.png」】
 * 并提供两种编号——
 *   - #2：本条消息中的全局顺序，对应 UI 列表顺序；
 *   - 图片 1：同类别内的顺序，对应「第一张图片」这类描述。
 * 文件名让用户还可以直接用文件名指代。
 */
function toUserContent(
  text: string,
  references: ReferenceMeta[] | undefined,
  parts: ReferenceParts,
): string | ChatContentPart[] {
  if (references === undefined || references.length === 0) return text

  const content: ChatContentPart[] = []
  if (text !== '') content.push({ type: 'text', text })

  const labels = referenceLabels(references)
  references.forEach((reference, index) => {
    content.push({ type: 'text', text: referenceAnchor(index + 1, labels[index] ?? '', reference) })
    content.push(parts.get(reference.path) ?? missingReference())
  })
  return content
}

function referenceAnchor(index: number, label: string, reference: ReferenceMeta): string {
  return `【参考文件 #${index}：${label}「${reference.name}」】`
}

function missingReference(): ChatContentPart {
  return { type: 'text', text: '（内容不可用）' }
}

function assertNever(value: never): never {
  throw new Error(`unhandled session event: ${JSON.stringify(value)}`)
}
