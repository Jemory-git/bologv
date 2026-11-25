/**
 * 参考文件 → 模型可见内容。
 *
 * 两条使用路径共用这一份规则：
 *   - 发送前校验：路径必须有效，且当前模型能处理其类别；
 *   - 每轮投影：历史里的引用重新按路径读取成 content parts。
 *
 * 只处理 doc 与 image；audio/video 的类别保留在契约里，暂未接入处理链路。
 */

import type { ChatContentPart, ModelDef, Vendor } from '@pkg/llm'
import { ModelNotFoundError } from '@pkg/llm'
import { REFERENCE_KIND_LABEL } from '@pkg/session'
import type { ReferenceMeta } from '@pkg/session'
import type { ReferenceParts } from '@pkg/runtime'
import { ValidationError } from '../errors.ts'
import { loadModels } from '../storage/index.ts'
import { inspectReferencePath, readReferenceData, readReferenceText } from './files.ts'

/**
 * 发送前校验：按顺序返回服务端快照。
 * 任何一项缺失或当前模型无法处理都会直接报错，不进入运行态。
 */
export async function assertReferencesUsable(
  paths: readonly string[],
  model: string,
): Promise<ReferenceMeta[]> {
  if (paths.length === 0) return []
  const def = await findModelDef(model)
  const references: ReferenceMeta[] = []
  const seen = new Set<string>()

  for (const path of paths) {
    const reference = await inspectReferencePath(path)
    if (seen.has(reference.path)) continue
    seen.add(reference.path)
    if (reference.kind === 'image' && !def.inputModalities.includes('image')) {
      throw new ValidationError(`模型 ${def.modelId} 不支持图片输入：${reference.name}`)
    }
    references.push(reference)
  }
  return references
}

/**
 * 投影用解析：不抛错。
 * 历史里引用的文件可能已被移动或删除，或当前模型不支持，统一降级成说明文本，
 * 保证历史重放不会因为一个文件而整轮失败。
 */
export async function resolveReferenceParts(
  references: readonly ReferenceMeta[],
  model: string,
): Promise<ReferenceParts> {
  const parts = new Map<string, ChatContentPart>()
  if (references.length === 0) return parts

  const def = await findModelDef(model).catch(() => null)
  for (const reference of references) {
    parts.set(reference.path, await toPart(reference, def))
  }
  return parts
}

// ---------------------------------------------------------------------------

async function toPart(reference: ReferenceMeta, def: ModelDef | null): Promise<ChatContentPart> {
  switch (reference.kind) {
    case 'doc': {
      const text = await readReferenceText(reference)
      return text === null ? unavailable() : { type: 'text', text }
    }
    case 'image': {
      if (def === null || !def.inputModalities.includes('image')) {
        return { type: 'text', text: '（当前模型不支持图片输入）' }
      }
      const data = await readReferenceData(reference)
      return data === null
        ? unavailable()
        : { type: 'image', mimeType: reference.mime, data: data.toString('base64') }
    }
    case 'audio':
    case 'video':
      return { type: 'text', text: `（暂不支持${REFERENCE_KIND_LABEL[reference.kind]}参考文件）` }
  }
}

function unavailable(): ChatContentPart {
  return { type: 'text', text: '（文件不可读取）' }
}

async function findModelDef(modelId: string): Promise<ModelDef> {
  const vendors: Vendor[] = await loadModels()
  for (const vendor of vendors) {
    const def = vendor.models.find((item) => item.modelId === modelId)
    if (def !== undefined) return def
  }
  throw new ModelNotFoundError(`找不到模型 ${modelId}，请在设置里添加`)
}
