/**
 * 图片引用快照：发送时把图片字节复制进会话目录，回填 snapshotPath。
 *
 * 多模态直传从快照读（不可变），原文件后续变更不影响历史重放。
 * 快照随会话目录同生命周期（删会话即清理）；文档不复制（内容由工具读取落 tool/result）。
 * 快照路径也为未来历史压缩预留：图片转文字描述后可经 snapshotPath 取回原图。
 */

import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import type { ReferenceMeta } from '@pkg/session'
import { readReferenceBytes } from './files.ts'

/** 对图片引用做快照并回填 snapshotPath；非图片原样返回。读不到的图片保留原 meta（不做快照）。 */
export async function snapshotImageReferences(
  references: readonly ReferenceMeta[],
  sessionDir: string,
): Promise<ReferenceMeta[]> {
  const result: ReferenceMeta[] = []
  for (const reference of references) {
    if (reference.kind !== 'image') {
      result.push(reference)
      continue
    }
    const data = await readReferenceBytes(reference)
    if (data === null) {
      result.push(reference)
      continue
    }
    const dir = join(sessionDir, 'references')
    await mkdir(dir, { recursive: true })
    // 内容 hash 文件名：相同内容复用同一快照（幂等）；内容变化落新文件，旧快照永不被覆写。
    const name = `${createHash('sha1').update(data).digest('hex')}${extname(reference.name)}`
    const snapshotPath = join(dir, name)
    await writeFile(snapshotPath, data)
    result.push({ ...reference, snapshotPath })
  }
  return result
}
