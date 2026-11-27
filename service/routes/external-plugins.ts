/**
 * 外置插件：
 *   GET /api/external-plugins                  → data: ExternalPluginsResponse
 *   GET /api/external-plugins/assets/:id/:file → 插件源码（供渲染进程动态 import）
 *
 * 资源接口不是业务 JSON，不走 envelope：找不到直接 404。
 * 否则浏览器会把 200 的 JSON 当模块解析，报错信息完全不可读。
 */

import Router from '@koa/router'
import { readFile } from 'node:fs/promises'
import { resolvePluginAsset } from '../external-plugins/assets.ts'
import { scanExternalPlugins } from '../external-plugins/catalog.ts'

export const externalPluginsRouter = new Router()

externalPluginsRouter.get('/', async (ctx: KoaContext) => {
  const data = await scanExternalPlugins()
  ctx.apiSuccess({ msg: 'ok', data })
})

externalPluginsRouter.get('/assets/:id/:file', async (ctx: KoaContext) => {
  const { id, file } = ctx.params
  if (id === undefined || file === undefined) {
    ctx.status = 404
    ctx.body = 'plugin asset not found'
    return
  }

  const asset = await resolvePluginAsset(id, file)
  if (asset === null) {
    ctx.status = 404
    ctx.body = 'plugin asset not found'
    return
  }

  ctx.set('Cache-Control', 'no-store')
  ctx.set('X-Content-Type-Options', 'nosniff')
  ctx.type = asset.type
  ctx.body = await readFile(asset.path)
})
