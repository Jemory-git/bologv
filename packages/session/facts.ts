/**
 * 会话摘要的只读推导。
 *
 * 列表等场景只需要「标题 / 最后活跃时间 / 预览」，不应该为此
 * 创建 SessionService、抢写者锁、把整份日志常驻内存。
 * 这里直接从 meta.json + 日志文件推导，必要时复用驻留实例的内存事件。
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { readSessionMeta } from './meta.ts'
import { LOG_FILE_NAME, parseLog } from './stores/jsonl.ts'
import type { SessionEvent, SessionFacts } from './types.ts'

/** 从事件数组推导摘要事实；title 由调用方提供（meta 中的用户标题）。 */
export function factsFromEvents(
  id: string,
  events: readonly SessionEvent[],
  title: string | null,
): SessionFacts {
  let firstUserText: string | null = null
  let lastPreview = ''
  let lastActive = 0

  for (const event of events) {
    lastActive = event.ts
    if (firstUserText === null && event.type === 'user/message') firstUserText = event.text
    if (event.type === 'user/message' || event.type === 'assistant/message') lastPreview = event.text
  }

  return { id, title, firstUserText, lastPreview, lastActive }
}

/** 只读读取整个日志；文件不存在时返回空数组。不持锁。 */
export async function readLogEvents(root: string, id: string): Promise<SessionEvent[]> {
  const text = await readFile(join(root, id, LOG_FILE_NAME), 'utf8').catch((): string => '')
  return parseLog(text)
}

/** 直接从磁盘推导摘要：不创建实例、不持锁。 */
export async function readSessionFacts(root: string, id: string): Promise<SessionFacts> {
  const [meta, events] = await Promise.all([
    readSessionMeta(root, id),
    readLogEvents(root, id),
  ])
  const title = typeof meta?.title === 'string' && meta.title.trim() !== '' ? meta.title : null
  return factsFromEvents(id, events, title)
}
