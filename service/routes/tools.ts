/**
 * 工具 API：catalog（只读）+ settings 读写。
 *
 * GET    /api/tools           → 返回 catalog（ToolCatalog 服务的派生）
 * GET    /api/tools/settings  → 返回 tools.json 内容
 * PUT    /api/tools/settings  → 写入 tools.json 并热更新（即时生效）
 */

import Router from '@koa/router'
import type { Booted } from '../../boot.ts'
import {
  TOOLS_CATALOG_SERVICE_NAME,
  TOOLS_MANAGER_SERVICE_NAME,
  type ToolCatalog,
  type ToolManager,
  type ToolSettings,
} from '@pkg/tools'
import { loadToolSettings, saveToolSettings } from '../storage/tools.ts'

export function createToolsRouter(bootedPromise: Promise<Booted>) {
  const router = new Router()

  // GET / → catalog
  router.get('/', async (ctx: KoaContext) => {
    const booted = await bootedPromise
    const catalog = booted.root.require<ToolCatalog>(TOOLS_CATALOG_SERVICE_NAME)
    ctx.apiSuccess({ msg: 'ok', data: { tools: catalog.list() } })
  })

  // GET /settings
  router.get('/settings', async (ctx: KoaContext) => {
    const settings = await loadToolSettings()
    ctx.apiSuccess({ msg: 'ok', data: settings })
  })

  // PUT /settings
  router.put('/settings', async (ctx: KoaContext) => {
    const body = (ctx.request.body ?? {}) as Partial<ToolSettings>
    // 简单形状校验
    const cleaned: ToolSettings = {}
    for (const [name, value] of Object.entries(body)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const v = value as unknown as Record<string, unknown>
        cleaned[name] = {
          enabled: v.enabled === undefined ? true : Boolean(v.enabled),
          favorite: v.favorite === undefined ? false : Boolean(v.favorite),
        }
      }
    }
    await saveToolSettings(cleaned)
    // 热更新：运行中的 ToolManager 立即应用新配置，无需重启。
    const booted = await bootedPromise
    booted.root.require<ToolManager>(TOOLS_MANAGER_SERVICE_NAME).reload(cleaned)
    ctx.apiSuccess({ msg: 'ok', data: { ok: true } })
  })

  return router
}
