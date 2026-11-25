/**
 * 会话能力接缝的 Service Definition，外加存储与检查点两份契约。
 *
 * 关键不变量：模型可见 ⟺ 已记录。会话只有事件日志这一份事实源，
 * 发往模型的消息由 projections/chat.ts 从日志投影而来。
 *
 * 多会话架构：SessionService 是纯工厂产物（不走 ctx.provide），
 * SessionManager 是唯一挂进 Cordis 的服务，负责按 id 产生 / 缓存 / 切换活跃会话。
 */

/** 参考文件类别：决定主进程的处理路径，不用于 UI 分组。 */
export const REFERENCE_KINDS = ['doc', 'image', 'audio', 'video'] as const
export type ReferenceKind = (typeof REFERENCE_KINDS)[number]

/** 类别短标签；UI 徽标与模型可见的引用标记共用，避免两处措辞不一致。 */
export const REFERENCE_KIND_LABEL: Record<ReferenceKind, string> = {
  doc: '文档',
  image: '图片',
  audio: '音频',
  video: '视频',
}

/**
 * 参考文件元信息快照。
 * 本地应用直接引用原文件路径，不复制文件；事件里存快照，
 * 因此即使原文件之后变化，历史仍能说明当时引用的是哪个文件。
 */
export interface ReferenceMeta {
  /** 绝对路径。 */
  path: string
  kind: ReferenceKind
  name: string
  mime: string
  size: number
}

/**
 * 每个引用的简短标识，形如「图片 2」「文档 1」。
 *
 * 语义完全由「数组顺序 + 类别」派生，客户端不上报别名：
 *   - 数组顺序就是用户在输入框里看到的顺序，因此「第三张图片」可映射到第 3 个 image；
 *   - 类别由服务端按扩展名判定，UI 与模型拿到的是同一份结论。
 * 投影时的模型可见标记与 UI 徽标都用这里，保证「用户说的」与「模型看到的」一致。
 */
export function referenceLabels(references: readonly ReferenceMeta[]): string[] {
  const counts = new Map<ReferenceKind, number>()
  return references.map((reference) => {
    const ordinal = (counts.get(reference.kind) ?? 0) + 1
    counts.set(reference.kind, ordinal)
    return `${REFERENCE_KIND_LABEL[reference.kind]} ${ordinal}`
  })
}

/**
 * 事件事实源。每条事件自带 sessionId，脱离外层包装也能归属到具体会话。
 * 同一 (sessionId, seq) 全局唯一。
 */
export type SessionEvent =
  | {
      sessionId: string
      seq: number
      ts: number
      type: 'user/message'
      text: string
      /** 本轮随消息提交的参考文件；没有引用时省略。 */
      references?: ReferenceMeta[]
    }
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
 * 会话摘要的原始事实：只描述「日志里有什么」，不含展示文案规则。
 * 标题回退、截断等展示决策由路由层负责。
 */
export interface SessionFacts {
  id: string
  /** meta.json 中的用户标题；未重命名为 null。 */
  title: string | null
  /** 首条用户消息原文；没有用户消息时为 null。 */
  firstUserText: string | null
  /** 最后一条消息原文；没有消息时为空串。 */
  lastPreview: string
  /** 最后一条事件的时间（epoch ms）；无事件为 0。 */
  lastActive: number
}

/**
 * 会话管理器：唯一挂进 Cordis 的会话服务。
 *
 * 两类访问明确分开：
 *   - 摘要 / 历史读取：只读，不创建实例、不持锁（summarize / readEvents）
 *   - 运行时：按需加载实例，并维护 per-session 单飞锁（switchActive / beginRun / finishRun）
 *
 * 空闲实例会被回收（flush + close），运行中的实例保留到本轮结束。
 */
export interface SessionManager {
  /** 当前活跃会话 id；未进入任何会话时访问会抛错。 */
  readonly activeId: string
  /** 当前活跃会话服务；切换后必然已加载。 */
  readonly active: SessionService
  /** 磁盘上所有会话 id（扫描 sessions 目录，合并已创建未落盘的实例）。 */
  list(): Promise<string[]>
  /** 只读摘要：有驻留实例时读内存事件，否则直接读日志。 */
  summarize(id: string): Promise<SessionFacts>
  /** 只读事件：有驻留实例时返回内存视图，否则直接读日志（不创建实例、不持锁）。 */
  readEvents(id: string): Promise<readonly SessionEvent[]>
  /** 创建新会话：生成唯一 id + 空 SessionService。 */
  create(): { id: string; service: SessionService }
  /** 读取用户设置的标题（meta.json）；未重命名时返回 null。 */
  getTitle(id: string): Promise<string | null>
  /** 重命名会话：标题写入 meta.json，不影响事件日志。 */
  rename(id: string, title: string): Promise<void>
  /** 删除会话：flush + 关闭存储 + 移除目录；不存在时幂等。 */
  remove(id: string): Promise<void>
  /** 切换活跃会话：加载目标实例，并释放上一个空闲实例。 */
  switchActive(id: string): Promise<void>
  /** 开始运行：加载实例并置为运行中；该会话已在运行时返回 false。 */
  beginRun(id: string): Promise<boolean>
  /** 结束运行：清除标记；非活跃会话立即释放（flush + close + 移出缓存）。 */
  finishRun(id: string): Promise<void>
  /** 查询某会话是否正在运行（per-session 单飞锁）。 */
  isRunning(id: string): boolean
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
