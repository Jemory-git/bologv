/**
 * 外置插件静态资源：路径安全解析 + MIME 白名单。
 *
 * 渲染进程用同源 URL 动态 import 这些文件，因此这里只放行插件目录内、
 * 扩展名在白名单里的单个文件：目录穿越与任意扩展名都直接视为不存在。
 */

import { stat } from 'node:fs/promises'
import { extname, isAbsolute, join, relative, resolve } from 'node:path'
import { PLUGINS_DIR, isValidPluginId } from './catalog.ts'

export interface PluginAsset {
  path: string
  type: string
}

const MIME: Record<string, string> = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
}

const ASSET_MAX_BYTES = 2 * 1024 * 1024

export async function resolvePluginAsset(id: string, file: string): Promise<PluginAsset | null> {
  if (!isValidPluginId(id)) return null

  const type = MIME[extname(file).toLowerCase()]
  if (type === undefined) return null

  const base = join(PLUGINS_DIR, id)
  const target = resolve(base, file)
  const rel = relative(base, target)
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) return null

  const info = await stat(target).catch(() => null)
  if (info === null || !info.isFile() || info.size > ASSET_MAX_BYTES) return null

  return { path: target, type }
}
