/**
 * 会话元数据：<sessionsRoot>/<id>/meta.json。
 *
 * 只持久化无法从事件日志推导的信息（当前是用户重命名后的标题）。
 * 读取失败一律视为「没有元数据」，不阻断列表与对话。
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export interface SessionMeta {
  /** 用户设置的标题；未重命名时不存在。 */
  title?: string
}

function metaPath(root: string, id: string): string {
  return join(root, id, 'meta.json')
}

/** 读取元数据；文件不存在或内容非法时返回 null。 */
export async function readSessionMeta(root: string, id: string): Promise<SessionMeta | null> {
  try {
    return JSON.parse(await readFile(metaPath(root, id), 'utf8')) as SessionMeta
  } catch {
    return null
  }
}

/** 写入元数据；目录不存在时自动创建。 */
export async function writeSessionMeta(root: string, id: string, meta: SessionMeta): Promise<void> {
  await mkdir(join(root, id), { recursive: true })
  await writeFile(metaPath(root, id), JSON.stringify(meta), 'utf8')
}
