/**
 * 健康检查。
 *   GET /api/health
 */

import Router from '@koa/router'

export const healthRouter = new Router()

healthRouter.get('/', (ctx: KoaContext) => {
  ctx.apiSuccess({ msg: 'ok', data: { ok: true, timestamp: Date.now() } })
})
