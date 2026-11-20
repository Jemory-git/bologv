/**
 * 会话能力接缝的 Service Definition，外加存储与检查点两份契约。
 * 对应真实仓库 packages/core/session、packages/session/session-persistence。
 *
 * 关键不变量：模型可见 ⟺ 已记录。会话只有事件日志这一份事实源，
 * 发往模型的消息由 projections/chat.ts 从日志投影而来。
 */

/** seq 是日志内的单调编号；ts 是事件发生时刻（epoch ms），由 append 统一赋值。 */
export type SessionEvent =
  | { seq: number; ts: number; type: 'user/message'; text: string }
  | { seq: number; ts: number; type: 'assistant/message'; text: string }
  | { seq: number; ts: number; type: 'tool/call'; callId: string; name: string; args: Record<string, unknown> }
  | { seq: number; ts: number; type: 'tool/result'; callId: string; name: string; ok: boolean; content: string }

/** append 的输入形状：seq 与 ts 由会话服务分配，调用方只提供业务字段。 */
type EventInput<T> = T extends unknown ? Omit<T, 'seq' | 'ts'> : never
export type SessionInput = EventInput<SessionEvent>

export interface SessionService {
  /** 追加一条事件并返回带 seq 的完整记录；此时尚未落盘。 */
  append(input: SessionInput): SessionEvent
  /** 只读视图；调用方不得修改。 */
  events(): readonly SessionEvent[]
  /** 把积压的事件写入存储；没有待写内容时立即返回。 */
  flush(): Promise<void>
}

/**
 * 存储 Provider 只需要实现这三个方法。
 * 换文件、换 SQLite、换远端都只替换这一层，会话服务与编排循环不受影响。
 */
export interface SessionStore {
  /** 读取全部历史事件；没有历史时返回空数组。调用即取得写者身份。 */
  load(): Promise<SessionEvent[]>
  /** 追加一批事件；调用方保证 seq 已分配且单调递增。 */
  append(events: readonly SessionEvent[]): Promise<void>
  /** 释放资源（例如写者锁）。实现必须可重复调用。 */
  close(): Promise<void>
}

/**
 * 检查点策略的接缝。
 * 存储只负责「怎么写」，策略负责「什么时候必须写完」。
 */
export interface CheckpointService {
  /** 在安全点调用：等待此前事件全部落盘。 */
  at(reason: string): Promise<void>
}

export const SESSION_SERVICE_NAME = 'session'
export const CHECKPOINT_SERVICE_NAME = 'checkpoint'
