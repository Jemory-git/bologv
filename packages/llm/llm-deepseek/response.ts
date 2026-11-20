/**
 * 响应解析：DeepSeek API 响应 → 我们的 LLMResult。
 * 响应来自网络、形状不可信：缺字段 / 非法 JSON 一律转成 LLMResponseError。
 */

import { LLMResponseError } from '@pkg/llm'
import type { LLMResult } from '@pkg/llm'
import type { DeepSeekResponse } from './types.ts'

export function parseResponse(resp: DeepSeekResponse): LLMResult {
  const msg = resp?.choices?.[0]?.message
  if (msg === undefined) throw new LLMResponseError('DeepSeek: 响应缺少 choices[0].message')

  if (msg.tool_calls !== undefined && msg.tool_calls.length > 0) {
    return {
      kind: 'tool_calls',
      calls: msg.tool_calls.map((tc) => {
        const name = tc.function?.name
        if (typeof tc.id !== 'string' || typeof name !== 'string') {
          throw new LLMResponseError('DeepSeek: tool_call 缺少 id 或 function.name')
        }
        return { id: tc.id, name, args: parseArgs(tc.function.arguments, name) }
      }),
    }
  }

  return { kind: 'text', text: msg.content ?? '' }
}

/** 工具参数必须是 JSON 对象；解析失败或形状不符都转成域错误。 */
function parseArgs(raw: string, toolName: string): Record<string, unknown> {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new LLMResponseError(`DeepSeek: 工具 "${toolName}" 的 arguments 不是合法 JSON`)
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new LLMResponseError(`DeepSeek: 工具 "${toolName}" 的 arguments 必须是 JSON 对象`)
  }
  return parsed as Record<string, unknown>
}
