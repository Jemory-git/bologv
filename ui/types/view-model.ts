/**
 * 渲染进程的视图模型：把会话事件归一化成界面可直接渲染的行。
 * 组件只依赖这里的类型，不直接解释 SessionEvent 的判别字段。
 */

import type { SessionEvent } from '@pkg/session'

/** 对话区的一条：事件、系统提示或错误。 */
export type ChatEntry =
  | { kind: 'event'; event: SessionEvent }
  | { kind: 'notice'; text: string }
  | { kind: 'error'; text: string }

/** 侧边栏会话条目：后端给出标题，前端只补展示用时间文案。 */
export interface SessionSummary {
  id: string
  title: string
  subtitle?: string
}
