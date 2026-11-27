/**
 * 系统设置读写。
 *   GET  /api/settings/plugins    → data: PluginSettingsResponse
 *   PUT  /api/settings/plugins    → data: PluginSettingsPutResponse
 *   GET  /api/settings/workspace  → data: WorkspaceSettingsResponse
 *   PUT  /api/settings/workspace  → data: WorkspaceSettingsPutResponse
 *
 * 插件启用状态存放在 userData/settings/plugins.json；
 * 工作目录存放在 userData/settings/system.json。
 * 只持久化可切换插件的启用状态；fixed 插件永远启用，不写入。
 */

import Router from '@koa/router'
import { loadPluginSettings, resolveWorkingDir, savePluginSettings, saveWorkingDir } from '../storage/index.ts'
import { ValidationError } from '../errors.ts'
import type { PluginSettingsPutRequest, WorkspaceSettingsPutRequest } from '../../shared/dto.ts'

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

settingsRouter.get('/workspace', async (ctx: KoaContext) => {
  ctx.apiSuccess({ msg: 'ok', data: { workingDir: await resolveWorkingDir() } })
})

settingsRouter.put('/workspace', async (ctx: KoaContext) => {
  const body = (ctx.request.body ?? {}) as WorkspaceSettingsPutRequest
  if (typeof body.workingDir !== 'string') {
    throw new ValidationError('workingDir must be a string')
  }
  const workingDir = await saveWorkingDir(body.workingDir)
  ctx.apiSuccess({ msg: 'ok', data: { ok: true, workingDir } })
})
