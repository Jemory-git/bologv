/**
 * API 请求/响应类型定义：前后端契约的单一来源。
 *
 * 落在 shared/，service 与 ui 两侧 tsconfig 都覆盖这里：
 * 路由 handler 和 ui/http 的客户端函数签名共同消费这份。
 */

import type { SessionEvent } from '@pkg/session/types.ts'
import type { Vendor } from '@pkg/llm/types.ts'

// —— Chat ——

export interface ChatRequest {
  text: string
  /** UI 选定的模型（modelId）；后端按请求时点最新配置解析，找不到报错。 */
  model: string
}

/** chat 只表示本轮完成；本轮事件经 IPC broadcast 推送，历史经 sessions API 拉取。 */
export interface ChatResponse {
  ok: true
}

// —— Models ——

export type ModelsResponse = Vendor[]

export interface ModelsPutRequest {
  vendors: Vendor[]
}

export interface ModelsPutResponse {
  ok: true
}

// —— Sessions ——

export interface SessionSummary {
  id: string
  /** 最后一条事件的时间（epoch ms）；0 表示无事件或旧日志时间未知。 */
  lastActive: number
  preview: string
}

export type SessionsListResponse = SessionSummary[]

export interface SessionEventsResponse {
  events: SessionEvent[]
}

// —— Plugins ——

export interface PluginSettingsResponse {
  enabled: string[]
}

export interface PluginSettingsPutRequest {
  enabled: string[]
}

export interface PluginSettingsPutResponse {
  ok: true
}

// —— Health ——

export interface HealthResponse {
  ok: true
  timestamp: number
}

// —— Error ——

export interface ErrorResponse {
  error: string
}
