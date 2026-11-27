/**
 * 协议注册表：Protocol → 适配器 的静态映射。
 * 新增协议 = 加一个适配器文件 + 这里一行；分发器与消费方零改动。
 * Record<Protocol, ...> 保证枚举扩展时编译期强制补齐。
 */

import type { Protocol } from '../../types.ts'
import type { ProtocolAdapter } from './types.ts'
import { openaiChat } from './openai-chat.ts'
import { openaiResponses } from './openai-responses.ts'
import { anthropic } from './anthropic.ts'

export const adapters: Record<Protocol, ProtocolAdapter> = {
  'openai-chat': openaiChat,
  'openai-responses': openaiResponses,
  anthropic,
}
