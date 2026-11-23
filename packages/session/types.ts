/**
 * 会话能力接缝的 Service Definition，外加存储与检查点两份契约。
 *
 * 关键不变量：模型可见 ⟺ 已记录。会话只有事件日志这一份事实源，
 * 发往模型的消息由 projections/chat.ts 从日志投影而来。
 *
 * 多会话架构：SessionService 是纯工厂产物（不走 ctx.provide），
 * SessionManager 是唯一挂进 Cordis 的服务，负责按 id 产生 / 缓存 / 切换活跃会话。
 */

/**
 * 事件事实源。每条事件自带 sessionId，脱离外层包装也能归属到具体会话。
 * 同一 (sessionId, seq) 全局唯一。
 */
export type SessionEvent =
  | { sessionId: string; seq: number; ts: number; type: 'user/message'; text: string }
  | { sessionId: string; seq: number; ts: number; type: 'assistant/message'; text: string }
  | { sessionId: string; seq: number; ts: number; type: 'tool/call'; callId: string; name: string; args: Record<string, unknown> }
  | { sessionId: string; seq: number; ts: number; type: 'tool/result'; callId: string; name: string; ok: boolean; content: string }

/** append 的输入形状：sessionId / seq / ts 由会话服务分配。 */
type EventInput<T> = T extends unknown ? Omit<T, 'sessionId' | 'seq' | 'ts'> : never
export type SessionInput = EventInput<SessionEvent>

/**
 * 单会话服务：事件内存视图 + 串行 flush 链。
 * 一个实例绑定一个 sessionId 与一个 SessionStore。
 */
export interface SessionService {
  /** 所属会话 id；构造时写入，对外只读。 */
  readonly id: string
  /** 追加一条事件并返回完整记录；此时尚未落盘。 */
  append(input: SessionInput): SessionEvent
  /** 只读视图；调用方不得修改。 */
  events(): readonly SessionEvent[]
  /** 把积压事件写入存储；没有待写时立即返回。 */
  flush(): Promise<void>
  /** 释放资源（关闭底层 store），幂等。 */
  close(): Promise<void>
}

/**
 * 存储 Provider：三个方法即可。
 * 换文件 / 换 SQLite / 换远端都只替换这一层，会话服务与编排循环不受影响。
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
 * 会话管理器：唯一挂进 Cordis 的会话服务。
 * 负责按 id 产生 / 缓存 / 切换活跃会话，并维护每个会话自己的 pending 状态（per-session 单飞锁）。
 */
export interface SessionManager {
  /** 当前活跃会话 id；启动时由调用方显式设置。 */
  readonly activeId: string
  /** 当前活跃会话服务；等价于 get(activeId)。 */
  readonly active: SessionService
  /** 磁盘上所有会话 id（扫描 sessions 目录）。 */
  list(): Promise<string[]>
  /** 按 id 取会话服务；不存在则创建空会话（含持久化存储）。 */
  get(id: string): SessionService
  /** 创建新会话：生成唯一 id + 空 SessionService。 */
  create(): { id: string; service: SessionService }
  /** 读取用户设置的标题（meta.json）；未重命名时返回 null。 */
  getTitle(id: string): Promise<string | null>
  /** 重命名会话：标题写入 meta.json，不影响事件日志。 */
  rename(id: string, title: string): Promise<void>
  /** 删除会话：flush + 关闭存储 + 移除目录；不存在时幂等。 */
  remove(id: string): Promise<void>
  /** 切换活跃会话；目标不存在时会自动创建。 */
  switchActive(id: string): void
  /** 查询某会话是否正在运行（per-session 单飞锁）。 */
  isRunning(id: string): boolean
  /** 设置某会话运行状态。 */
  setRunning(id: string, value: boolean): void
}

/**
 * 检查点策略的接缝。
 * 存储只负责「怎么写」，策略负责「什么时候必须写完」。
 */
export interface CheckpointService {
  /** 在安全点调用：等待此前事件全部落盘。 */
  at(reason: string): Promise<void>
}

export const SESSION_MANAGER_SERVICE_NAME = 'sessionManager'
export const CHECKPOINT_SERVICE_NAME = 'checkpoint'
