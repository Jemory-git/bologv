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
  /** 本轮写入的会话 id；后端会切换 active session 并写事件到该会话。 */
  sessionId: string
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
  /** 展示标题：用户重命名 > 首条用户消息 > 「会话 xxxxxx」。 */
  title: string
  /** 最后一条事件的时间（epoch ms）；0 表示无事件。 */
  lastActive: number
  /** 最后一条消息的截断文本，供列表辅助展示。 */
  preview: string
}

export interface SessionCreateResponse {
  id: string
}

export interface SessionRenameRequest {
  title: string
}

export interface SessionRenameResponse {
  id: string
  title: string
}

export interface SessionDeleteResponse {
  id: string
}

export type SessionsListResponse = SessionSummary[]

export interface SessionEventsResponse {
  events: SessionEvent[]
}

// —— External Plugins ——

/** 一个可用的外置插件：元信息来自 manifest.json，代码启用时才加载。 */
export interface ExternalPluginInfo {
  id: string
  label: string
  description?: string
  version?: string
  /** 入口文件名，相对插件目录；UI 负责拼成同源 URL。 */
  entry: string
}

/** 无法识别的插件目录：保留在清单里提示用户，而不是静默丢弃。 */
export interface ExternalPluginIssue {
  /** 目录名。 */
  dir: string
  /** 不可用原因。 */
  reason: string
}

export interface ExternalPluginsResponse {
  /** 外置插件根目录（绝对路径，供 UI 展示）。 */
  dir: string
  plugins: ExternalPluginInfo[]
  broken: ExternalPluginIssue[]
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
