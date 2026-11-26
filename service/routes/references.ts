/**
 * 参考文件检查与内容读取。
 *
 *   POST /api/references/inspect        → data: { references, errors }
 *   GET  /api/references/content?path=  → 原始字节（图片/文本）
 *
 * 只读取元信息或按需读取内容，不复制文件；路径无效或类别不支持的文件逐条返回错误，
 * 不阻塞同批次其他文件。
 */

import Router from '@koa/router'
import { ValidationError } from '../errors.ts'
import { inspectReferencePath, inspectReferencePaths, MAX_REFERENCE_PATHS, readReferenceBytes } from '../references/files.ts'
import type { InspectReferencesRequest } from '../../shared/dto.ts'

export const referencesRouter = new Router()

referencesRouter.post('/inspect', async (ctx: KoaContext) => {
  const body = (ctx.request.body ?? {}) as Partial<InspectReferencesRequest>
  const paths = readPaths(body.paths)
  if (paths.length > MAX_REFERENCE_PATHS) {
    throw new ValidationError(`一次最多添加 ${MAX_REFERENCE_PATHS} 个参考文件`)
  }

  const result = await inspectReferencePaths(paths)
  ctx.apiSuccess({ msg: 'ok', data: result })
})

/**
 * 预览内容：原样返回文件字节，由响应头说明类别。
 *
 * 用响应头而不是 Content-Type 区分图片与文本，是因为 .json/.html 这类文档
 * 本身就是 application/json、text/html，光看 MIME 会和错误 envelope 混淆。
 * 读取规则与发送时完全一致：同一个 inspectReferencePath 判定类别与上限。
 */
referencesRouter.get('/content', async (ctx: KoaContext) => {
  const reference = await inspectReferencePath(readPath(ctx.query.path))
  const data = await readReferenceBytes(reference)
  if (data === null) throw new ValidationError(`文件不可读取：${reference.name}`)

  ctx.set('X-Reference-Kind', reference.kind)
  ctx.set('Content-Type', reference.mime)
  ctx.set('Cache-Control', 'no-store')
  ctx.body = data
})

function readPaths(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ValidationError('paths 必须是非空数组')
  }
  const paths: string[] = []
  for (const item of value) {
    if (typeof item !== 'string' || item.trim() === '') {
      throw new ValidationError('paths 只能包含非空字符串')
    }
    paths.push(item.trim())
  }
  return [...new Set(paths)]
}

function readPath(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ValidationError('path 必须是非空字符串')
  }
  return value.trim()
}
