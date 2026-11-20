/**
 * 插件启用状态读写。
 *   GET  /api/settings/plugins  → data: PluginSettingsResponse
 *   PUT  /api/settings/plugins  → data: PluginSettingsPutResponse
 *
 * 存储在 userData/settings/plugins.json。
 * 只持久化可切换插件的启用状态；fixed 插件永远启用，不写入。
 */

import Router from '@koa/router'
import { loadPluginSettings, savePluginSettings } from '../storage/index.ts'
import { ValidationError } from '../errors.ts'
import type { PluginSettingsPutRequest } from '../../shared/dto.ts'

export const settingsRouter = new Router()

settingsRouter.get('/plugins', async (ctx: KoaContext) => {
  const data = await loadPluginSettings()
  ctx.apiSuccess({ msg: 'ok', data: { enabled: data.enabled } })
})

settingsRouter.put('/plugins', async (ctx: KoaContext) => {
  const body = (ctx.request.body ?? {}) as PluginSettingsPutRequest
  if (!Array.isArray(body.enabled) || !body.enabled.every((v) => typeof v === 'string')) {
    throw new ValidationError('enabled must be an array of strings')
  }
  await savePluginSettings({ enabled: body.enabled })
  ctx.apiSuccess({ msg: 'ok', data: { ok: true } })
})
