/**
 * 图片内嵌：把图片引用读成模型可见的多模态片段。
 *
 * 路径化设计：user 消息只带路径，文档由模型调 read_file 读取（落 tool/result，不可变）。
 * 这里只负责「图片内嵌」一条接缝：仅当主模型支持读图时，把图片引用从快照读成多模态片段。
 * 投影解析不抛错，缺失降级。
 */

import type { ChatContentPart } from '@pkg/models/language/types.ts'
import type { ReferenceMeta } from '@pkg/session'
import type { ImageEmbedParts } from '@pkg/loop'
import { findModelDef } from '../storage/index.ts'
import { readReferenceBytes } from './files.ts'

/**
 * 图片内嵌解析（不抛错）：仅当主模型支持 image 输入时，把图片引用从快照（snapshotPath）
 * 读成多模态片段；文档与非 capable 模型一律不内嵌（走路径 + 工具路线）。
 * 快照不可变，保证每轮重投影内容恒定。
 */
export async function resolveImageEmbeds(
  references: readonly ReferenceMeta[],
  model: string,
): Promise<ImageEmbedParts> {
  const imageEmbeds = new Map<string, ChatContentPart>()
  if (references.length === 0) return imageEmbeds

  const def = await findModelDef(model).catch(() => null)
  if (def === null || !def.inputModalities.includes('image')) return imageEmbeds

  for (const reference of references) {
    if (reference.kind !== 'image') continue
    const source = { ...reference, path: reference.snapshotPath ?? reference.path }
    const data = await readReferenceBytes(source)
    if (data !== null) {
      imageEmbeds.set(reference.path, { type: 'image', mimeType: reference.mime, data: data.toString('base64') })
    }
  }
  return imageEmbeds
}
