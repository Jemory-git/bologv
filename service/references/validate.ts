/**
 * 发送前校验：参考文件路径必须有效（存在、是文件、类型可处理），模型必须存在。
 * 在占用运行态之前失败，避免带着发不出去的消息进入运行态。
 * 图片不在此校验主模型读图能力——无读图能力时可走 understand_image 工具。
 */

import type { ReferenceMeta } from '@pkg/session'
import { findModelDef } from '../storage/index.ts'
import { inspectReferencePath } from './files.ts'

/** 逐条检查并按路径去重；任一路径无效即抛错（与 inspect 路由的逐条容错不同）。 */
export async function assertReferencesUsable(
  paths: readonly string[],
  model: string,
): Promise<ReferenceMeta[]> {
  if (paths.length === 0) return []
  await findModelDef(model)
  const references: ReferenceMeta[] = []
  const seen = new Set<string>()

  for (const path of paths) {
    const reference = await inspectReferencePath(path)
    if (seen.has(reference.path)) continue
    seen.add(reference.path)
    references.push(reference)
  }
  return references
}
