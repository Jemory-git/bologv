/**
 * 外置插件目录：扫描 + manifest 校验 + 首次安装示例。
 *
 * 目录约定（APP_PATHS.userPluginsDir，即 userData/plugins/<id>/）：
 *   manifest.json  元信息；扫描阶段只读它，不执行插件代码
 *   main.js        入口；仅在启用时由渲染进程动态 import
 *
 * 单个目录损坏不影响其他插件：无法识别的目录进 broken 列表，由 UI 展示原因。
 */

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { APP_PATHS } from '../paths.ts'
import type { Dirent } from 'node:fs'
import type { ExternalPluginInfo, ExternalPluginIssue, ExternalPluginsResponse } from '../../shared/dto.ts'

/**
 * 外置插件根目录。
 * 开发模式直接读源码目录：主进程监听其变化并通知 UI 重载，无需复制或手动同步；
 * 生产模式读 userData：安装目录只读，用户安装的插件只能落在用户数据里。
 */
export const EXTERNAL_PLUGINS_DIR = process.env.NODE_ENV === 'production' ? APP_PATHS.userPluginsDir : APP_PATHS.bundledPluginsDir

const MANIFEST_FILE = 'manifest.json'
const DEFAULT_ENTRY = 'main.js'
const MANIFEST_MAX_BYTES = 16 * 1024
const ID_PATTERN = /^[a-z][a-z0-9-]{1,31}$/
const ENTRY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

/** 插件 id 同时是目录名；资源路由用它做第一道校验。 */
export function isValidPluginId(id: string): boolean {
  return ID_PATTERN.test(id)
}

// ---------------------------------------------------------------------------
// 扫描
// ---------------------------------------------------------------------------

export async function scanExternalPlugins(): Promise<ExternalPluginsResponse> {
  await ensureSeeded()

  const plugins: ExternalPluginInfo[] = []
  const broken: ExternalPluginIssue[] = []

  let entries: Dirent[]
  try {
    entries = await readdir(EXTERNAL_PLUGINS_DIR, { withFileTypes: true })
  } catch {
    return { dir: EXTERNAL_PLUGINS_DIR, plugins, broken }
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const result = await readManifest(entry.name)
    if (result.ok) plugins.push(result.info)
    else broken.push({ dir: entry.name, reason: result.reason })
  }

  plugins.sort((a, b) => a.id.localeCompare(b.id))
  broken.sort((a, b) => a.dir.localeCompare(b.dir))
  return { dir: EXTERNAL_PLUGINS_DIR, plugins, broken }
}

type ManifestRead =
  | { ok: true; info: ExternalPluginInfo }
  | { ok: false; reason: string }

async function readManifest(dirName: string): Promise<ManifestRead> {
  if (!isValidPluginId(dirName)) {
    return { ok: false, reason: '目录名须为 2-32 位小写字母/数字/连字符，并以字母开头' }
  }

  const path = join(EXTERNAL_PLUGINS_DIR, dirName, MANIFEST_FILE)
  let text: string
  try {
    text = await readFile(path, 'utf-8')
  } catch {
    return { ok: false, reason: `缺少 ${MANIFEST_FILE}` }
  }

  if (Buffer.byteLength(text, 'utf-8') > MANIFEST_MAX_BYTES) {
    return { ok: false, reason: `${MANIFEST_FILE} 超过 16KB` }
  }

  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, reason: `${MANIFEST_FILE} 不是合法 JSON` }
  }
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, reason: `${MANIFEST_FILE} 必须是对象` }
  }

  const record = raw as Record<string, unknown>
  const id = asString(record.id)
  if (id === undefined) return { ok: false, reason: 'id 必填' }
  if (id !== dirName) return { ok: false, reason: `id "${id}" 与目录名不一致` }

  const label = asString(record.label)
  if (label === undefined) return { ok: false, reason: 'label 必填' }

  const entry = asString(record.entry) ?? DEFAULT_ENTRY
  if (!ENTRY_PATTERN.test(entry)) {
    return { ok: false, reason: `entry "${entry}" 必须是单个文件名` }
  }

  return {
    ok: true,
    info: {
      id,
      label,
      entry,
      description: asString(record.description),
      version: asString(record.version),
    },
  }
}

function asString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

// ---------------------------------------------------------------------------
// 示例插件安装 —— 只在插件目录整体不存在时执行一次
// ---------------------------------------------------------------------------

let seeding: Promise<void> | undefined

function ensureSeeded(): Promise<void> {
  seeding ??= seed()
  return seeding
}

async function seed(): Promise<void> {
  try {
    await readdir(EXTERNAL_PLUGINS_DIR)
    return // 目录已存在：用户已接管，不覆盖、也不复活被删掉的插件
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') return
  }

  let names: string[]
  try {
    names = await readdir(APP_PATHS.bundledPluginsDir)
  } catch {
    return // 精简单文件构建里没有示例资源：跳过
  }

  for (const name of names) {
    await copyTree(join(APP_PATHS.bundledPluginsDir, name), join(EXTERNAL_PLUGINS_DIR, name))
  }
}

/** asar 内只能用 readFile 读取，因此按文件递归复制而不是 copyFile。 */
async function copyTree(from: string, to: string): Promise<void> {
  const entries = await readdir(from, { withFileTypes: true })
  await mkdir(to, { recursive: true })
  for (const entry of entries) {
    const src = join(from, entry.name)
    const dest = join(to, entry.name)
    if (entry.isDirectory()) await copyTree(src, dest)
    else if (entry.isFile()) await writeFile(dest, await readFile(src))
  }
}
