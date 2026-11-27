/**
 * 规则驱动的假模型：不依赖任何厂商配置，用于无 key 环境演示完整循环。
 *
 * 它演示的重点是：实现只依赖 Service Definition，不认识 agent-loop。
 */

import { randomUUID } from 'node:crypto'
import type { PluginObject } from '@pkg/cordis'
import { LLM_SERVICE_NAME } from './types.ts'
import type { ChatContentPart, LLMService } from './types.ts'

export const mockLLM: PluginObject = {
  name: 'mock-llm',
  apply(ctx) {
    const service: LLMService = {
      async chat(request) {
        const last = request.messages.at(-1)
        const hasTool = (name: string) => request.tools.some((tool) => tool.name === name)

        // 上一轮是工具结果：模型「读到结果」后给出最终回答。
        if (last?.role === 'tool') {
          return { kind: 'text', text: `工具 ${last.toolName} 返回：${toPlainText(last.content)}` }
        }

        const userText =
          [...request.messages].reverse().find((message) => message.role === 'user')?.content ?? ''
        const prompt = toPlainText(userText)

        const readMatch = /(?:读取|打开|read)\s*([^\s，。]+)/i.exec(prompt)
        if (readMatch !== null && hasTool('read_file')) {
          return {
            kind: 'tool_calls',
            calls: [{ id: randomUUID(), name: 'read_file', args: { path: readMatch[1] } }],
          }
        }

        if (/(时间|几点|time|date)/i.test(prompt) && hasTool('now')) {
          return { kind: 'tool_calls', calls: [{ id: randomUUID(), name: 'now', args: {} }] }
        }

        return { kind: 'text', text: `（mock 回声）你说：${prompt}` }
      },
    }

    ctx.provide<LLMService>(LLM_SERVICE_NAME, service)
  },
}

/** mock 只关心文本，忽略图片片段。 */
function toPlainText(content: string | ChatContentPart[]): string {
  if (typeof content === 'string') return content
  return content
    .filter((part): part is Extract<ChatContentPart, { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
}
