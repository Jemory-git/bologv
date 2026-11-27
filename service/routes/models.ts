/**
 * 模型配置读写。
 *   GET  /api/models  → data: Vendor[]
 *   PUT  /api/models  → data: { ok: true }
 */

import Router from '@koa/router'
import { loadModels, parseVendors, saveModels } from '../storage/index.ts'
import { ValidationError } from '../errors.ts'
import type { ModelsPutRequest } from '../../shared/dto.ts'
import type { Vendor } from '@pkg/models/types.ts'

export const modelsRouter = new Router()

modelsRouter.get('/', async (ctx: KoaContext) => {
  ctx.apiSuccess({ msg: 'ok', data: await loadModels() })
})

modelsRouter.put('/', async (ctx: KoaContext) => {
  const body = (ctx.request.body ?? {}) as ModelsPutRequest
  // 边界校验在服务端：前端 ModelModal 的校验只是体验，不是防线。
  let vendors: Vendor[]
  try {
    vendors = parseVendors(body.vendors)
  } catch (error) {
    throw new ValidationError(error instanceof Error ? error.message : String(error))
  }
  await saveModels(vendors)
  ctx.apiSuccess({ msg: 'ok', data: { ok: true } })
})
