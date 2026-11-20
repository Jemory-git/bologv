/**
 * 系统/UI 偏好读写：system.json。
 * 预留，当前无明确 schema。
 */

import { join } from 'node:path'
import { SETTINGS_DIR, readJsonFile, writeJsonFile } from './internal.ts'

const SYSTEM_FILE = join(SETTINGS_DIR, 'system.json')

export async function loadSystem(): Promise<Record<string, unknown>> {
  return readJsonFile(SYSTEM_FILE, {}, (raw) => {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      throw new Error('system.json must be an object')
    }
    return raw as Record<string, unknown>
  })
}

export async function saveSystem(data: Record<string, unknown>): Promise<void> {
  await writeJsonFile(SYSTEM_FILE, data)
}
