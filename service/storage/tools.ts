/**
 * 工具配置读写：tools.json。
 *
 * 形状：{ [toolName]: { enabled: boolean, favorite: boolean } }
 * 缺失字段用默认值 enabled=true, favorite=false。
 * 文件缺失 → 返回空对象（所有发现的 tool 默认启用、非 favorite）。
 */

import { join } from 'node:path'
import { SETTINGS_DIR, readJsonFile, writeJsonFile } from './internal.ts'
import type { ToolSettings, ToolSettingsEntry } from '@pkg/tools'

const TOOLS_FILE = join(SETTINGS_DIR, 'tools.json')

const DEFAULT: ToolSettings = {}

export async function loadToolSettings(): Promise<ToolSettings> {
  return readJsonFile(TOOLS_FILE, DEFAULT, parseSettings)
}

function parseSettings(raw: unknown): ToolSettings {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('tools.json must be an object')
  }
  const result: ToolSettings = {}
  for (const [name, value] of Object.entries(raw)) {
    result[name] = parseEntry(value, name)
  }
  return result
}

function parseEntry(value: unknown, name: string): ToolSettingsEntry {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`tools.json.${name} must be an object`)
  }
  const v = value as unknown as Record<string, unknown>
  const enabled = v.enabled === undefined ? true : Boolean(v.enabled)
  const favorite = v.favorite === undefined ? false : Boolean(v.favorite)
  return { enabled, favorite }
}

export async function saveToolSettings(data: ToolSettings): Promise<void> {
  await writeJsonFile(TOOLS_FILE, data)
}
