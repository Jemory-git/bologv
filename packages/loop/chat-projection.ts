/**
 * 把事件日志投影成模型请求消息。对应真实仓库 packages/session/session-projection。
 *
 * 投影是纯函数：同一份日志 + 同一份引用解析结果，永远算出同一串消息，
 * 因此压缩、裁剪、换 provider 都只改这里，历史事实一条不动。
 * 这是「模型可见 ⟺ 已记录」的后半句。
 */

import type { ChatContentPart, ChatMessage } from '@pkg/models/language/types.ts'
import { referenceLabels } from '@pkg/session'
import type { ReferenceMeta, SessionEvent } from '@pkg/session'

/** 引用路径 → 图片多模态片段（capable 模型直传）；读取失败的图片不内嵌。 */
export type ImageEmbedParts = ReadonlyMap<string, ChatContentPart>

export function toChatMessages(events: readonly SessionEvent[], imageEmbeds: ImageEmbedParts = new Map()): ChatMessage[] {
  const messages: ChatMessage[] = []
  for (const event of events) {
    switch (event.type) {
      case 'user/message':
        messages.push({ role: 'user', content: toUserContent(event.text, event.references, imageEmbeds) })
        break
      case 'assistant/message':
        messages.push({
          role: 'assistant',
          content: event.text,
          ...(event.providerState !== undefined ? { providerState: event.providerState } : {}),
        })
        break
      case 'tool/call': {
        // 同一轮的连续调用合并为一条 assistant 消息，
        // 对应 provider 协议里 assistant.tool_calls 数组。
        // 携带信封的空文本 assistant 事件也参与合并（信封与调用同属一轮）；
        // 无信封的普通文本消息不吸收 call，保证旧日志投影行为不变。
        const call = { id: event.callId, name: event.name, args: event.args }
        const last = messages.at(-1)
        if (last?.role === 'assistant' && (last.toolCalls !== undefined || last.providerState !== undefined)) {
          if (last.toolCalls === undefined) last.toolCalls = []
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
 * 有引用时把文本与「锚点 + 路径」拼接；没有引用时保持纯字符串。
 *
 * 每个引用发一条模型可见标记（含路径，供模型调工具读取）：
 *   【参考文件 #2：图片 1「cat.png」】路径：/abs/cat.png
 * 两种编号——
 *   - #2：本条消息中的全局顺序，对应 UI 列表顺序；
 *   - 图片 1：同类别内的顺序，对应「第一张图片」这类描述。
 * 标号从完整引用列表派生，与是否内嵌无关。仅当 imageEmbeds 提供图片片段（capable 模型直传）时
 * 才追加多模态内容，且图片紧跟自身锚点；文档不内嵌，由模型调 read_file 读取。
 */
function toUserContent(
  text: string,
  references: ReferenceMeta[] | undefined,
  imageEmbeds: ImageEmbedParts,
): string | ChatContentPart[] {
  if (references === undefined || references.length === 0) return text

  const labels = referenceLabels(references)
  const anchors = references.map((reference, index) => referenceAnchor(index + 1, labels[index] ?? '', reference))

  // 无图片内嵌（工具路线）：纯文本「锚点 + 路径」，模型据此调 read_file/understand_image。
  if (!references.some((reference) => imageEmbeds.has(reference.path))) {
    const lines = anchors.join('\n')
    return text === '' ? lines : `${text}\n${lines}`
  }

  // 有图片内嵌（capable 模型）：每个引用发锚点，图片片段紧跟自身锚点（标号不变量）。
  const content: ChatContentPart[] = []
  if (text !== '') content.push({ type: 'text', text })
  references.forEach((reference, index) => {
    content.push({ type: 'text', text: anchors[index] ?? '' })
    const part = imageEmbeds.get(reference.path)
    if (part !== undefined) content.push(part)
  })
  return content
}

function referenceAnchor(index: number, label: string, reference: ReferenceMeta): string {
  return `【参考文件 #${index}：${label}「${reference.name}」】路径：${reference.path}`
}

function assertNever(value: never): never {
  throw new Error(`unhandled session event: ${JSON.stringify(value)}`)
}
