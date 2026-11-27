/**
 * 系统配置读写：system.json。
 *
 * 当前只有一项——工作目录 workingDir。它同时是：
 *   1. 文件类工具的沙箱根（写不出去、读不进来）；
 *   2. shell 的执行目录；
 *   3. prompt 里模型看到的工作目录。
 * 三者必须同源，因此这里是唯一事实来源，boot 与 HTTP 接口都通过 resolveWorkingDir 取用。
 */

import { mkdir, stat } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'
import { APP_PATHS } from '../paths.ts'
import { readJsonFile, writeJsonFile } from './json-file.ts'
import { ValidationError } from '../errors.ts'

const SYSTEM_FILE = join(APP_PATHS.settingsDir, 'system.json')

export interface SystemSettings {
  /** 工作目录绝对路径；缺失时回退默认目录（APP_PATHS.defaultWorkingDir）。 */
  workingDir?: string
}

export async function loadSystem(): Promise<SystemSettings> {
  return readJsonFile(SYSTEM_FILE, {}, parseSystem)
}

export async function saveSystem(data: SystemSettings): Promise<void> {
  await writeJsonFile(SYSTEM_FILE, data)
}

/**
 * 解析当前生效的工作目录：配置值可用则用它，否则回退默认目录（并确保其存在）。
 * boot 与 GET 接口共用这一份推导，UI 看到的路径与实际使用的路径永远一致。
 */
export async function resolveWorkingDir(): Promise<string> {
  const configured = (await loadSystem()).workingDir
  if (configured !== undefined && await isDirectory(configured)) return resolve(configured)

  await mkdir(APP_PATHS.defaultWorkingDir, { recursive: true })
  return resolve(APP_PATHS.defaultWorkingDir)
}

/**
 * 保存工作目录：必须是已存在的绝对目录。
 * 保存后不热切换（沙箱根在启动时确定），由 UI 提示重启生效。
 */
export async function saveWorkingDir(input: string): Promise<string> {
  const value = input.trim()
  if (value === '') throw new ValidationError('workingDir 不能为空')
  if (!isAbsolute(value)) throw new ValidationError('workingDir 必须是绝对路径')
  if (!(await isDirectory(value))) throw new ValidationError(`目录不存在或不可访问：${value}`)

  const workingDir = resolve(value)
  await saveSystem({ ...(await loadSystem()), workingDir })
  return workingDir
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}

function parseSystem(raw: unknown): SystemSettings {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('system.json must be an object')
  }
  const record = raw as Record<string, unknown>
  const settings: SystemSettings = {}
  if (record.workingDir !== undefined) {
    if (typeof record.workingDir !== 'string') throw new Error('system.json.workingDir must be a string')
    settings.workingDir = record.workingDir
  }
  return settings
}
