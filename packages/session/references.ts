/**
 * 参考文件域类型：类别、元信息快照与简短标签。
 *
 * ReferenceMeta 是 user/message 事件的载荷，随消息记入事件日志；
 * 标签供 UI 徽标与模型可见的引用标记共用，保证「用户说的」与「模型看到的」一致。
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
 * 文档按原路径引用、不复制，内容由模型调工具读取后落 tool/result（不可变）。
 * 图片发送时快照进会话目录（snapshotPath），多模态直传从快照读，原文件变更不影响历史。
 */
export interface ReferenceMeta {
  /** 原始绝对路径（用户引用的文件）。 */
  path: string
  kind: ReferenceKind
  name: string
  mime: string
  size: number
  /** 图片快照的绝对路径（会话目录内，不可变）；仅图片有。多模态直传从此读，避免原文件变更漂移。 */
  snapshotPath?: string
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
