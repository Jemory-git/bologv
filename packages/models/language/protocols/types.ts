/**
 * 协议适配器接缝：把统一的聊天契约翻译成某一阵营的线上协议。
 *
 * 纯模块，不认识 Cordis、不发请求：
 *   - headers：认证方式（Bearer / x-api-key...）；
 *   - encode：ChatRequest → 完整请求 body（含 model）；
 *   - decode：原始响应 → LLMResult（形状不可信，非法即抛 LLMResponseError）。
 * 传输与厂商解析由分发器（../plugin.ts）负责。
 */

import type { ChatRequest, LLMResult } from '../types.ts'

export interface ProtocolAdapter {
  headers(apiKey: string): Record<string, string>
  encode(request: ChatRequest, modelId: string): Record<string, unknown>
  decode(raw: unknown): LLMResult
}
