/**
 * 插件启用状态读写：plugins.json。
 * 只持久化可切换插件的启用状态；fixed 插件永远启用，不写入。
 */

import { join } from 'node:path'
import { APP_PATHS } from '../paths.ts'
import { readJsonFile, writeJsonFile } from './json-file.ts'

const PLUGINS_FILE = join(APP_PATHS.settingsDir, 'plugins.json')

export interface PluginSettings {
  /** 可切换插件 id 列表；不包含 fixed 插件。 */
  enabled: string[]
}

const DEFAULT: PluginSettings = { enabled: [] }

export async function loadPluginSettings(): Promise<PluginSettings> {
  return readJsonFile(PLUGINS_FILE, DEFAULT, parseSettings)
}

function parseSettings(raw: unknown): PluginSettings {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('plugins.json must be an object')
  }
  const enabled = (raw as Record<string, unknown>).enabled
  if (!Array.isArray(enabled) || enabled.some((id) => typeof id !== 'string')) {
    throw new Error('plugins.json enabled must be a string array')
  }
  return { enabled: enabled as string[] }
}

export async function savePluginSettings(data: PluginSettings): Promise<void> {
  await writeJsonFile(PLUGINS_FILE, data)
}
