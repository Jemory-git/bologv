/**
 * Tool 运行时能力工厂：构造 ToolFsApi / ToolShellApi。
 *
 * 所有能力都有沙箱/安全约束：
 *   - fs：只允许读写 rootDir 之内，超出路径直接报错
 *   - shell：默认 30s 超时，输出截断 20KB
 */

import { isAbsolute, relative, resolve, sep } from 'node:path'
import { execFile } from 'node:child_process'
import { readFile, realpath, stat, writeFile, mkdir, readdir } from 'node:fs/promises'
import { promisify } from 'node:util'
import type { ToolFsApi, ToolShellApi } from './types.ts'

const MAX_FILE_BYTES = 2 * 1024 * 1024   // 2MB
const MAX_OUTPUT_CHARS = 8000            // 文本截断
const MAX_SHELL_OUTPUT = 20 * 1024        // shell 输出截断
const DEFAULT_SHELL_TIMEOUT = 30_000

const execFileAsync = promisify(execFile)

// —— 路径安全检查 ——

/** target 是否位于 root 之内（含 root 自身）。 */
function isInside(root: string, target: string): boolean {
  const rel = relative(root, target)
  return rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)
}

function resolveSafe(rootDir: string, relPath: string): string {
  if (typeof relPath !== 'string' || relPath.trim() === '') {
    throw new Error('path must be a non-empty string')
  }
  const absolute = resolve(rootDir, relPath)
  if (!isInside(rootDir, absolute)) throw new Error(`path escapes sandbox: ${relPath}`)
  return absolute
}

async function verifyRealPath(rootDir: string, absolute: string): Promise<void> {
  // 解析符号链接后再校验一次，防止链接把读取带出沙箱。
  const realRoot = await realpath(rootDir)
  const realTarget = await realpath(absolute)
  if (!isInside(realRoot, realTarget)) throw new Error(`path escapes sandbox after symlink resolution`)
}

// —— FS API ——

export function buildFsApi(rootDir: string): ToolFsApi {
  const resolvedRoot = resolve(rootDir)

  return {
    rootDir: resolvedRoot,

    async readText(relPath) {
      const absolute = resolveSafe(resolvedRoot, relPath)
      await verifyRealPath(resolvedRoot, absolute)
      const info = await stat(absolute)
      if (info.size > MAX_FILE_BYTES) {
        throw new Error(`file too large: ${info.size} bytes (max ${MAX_FILE_BYTES})`)
      }
      const text = await readFile(absolute, 'utf-8')
      return text.length > MAX_OUTPUT_CHARS ? `${text.slice(0, MAX_OUTPUT_CHARS)}…（已截断）` : text
    },

    async readAsBase64(relPath) {
      const absolute = resolveSafe(resolvedRoot, relPath)
      await verifyRealPath(resolvedRoot, absolute)
      const info = await stat(absolute)
      if (info.size > MAX_FILE_BYTES) {
        throw new Error(`file too large: ${info.size} bytes (max ${MAX_FILE_BYTES})`)
      }
      const buf = await readFile(absolute)
      const mime = guessMime(absolute)
      return { mime, data: buf.toString('base64') }
    },

    async writeText(relPath, content) {
      const absolute = resolveSafe(resolvedRoot, relPath)
      const parent = resolve(absolute, '..')
      await mkdir(parent, { recursive: true })
      await writeFile(absolute, content, 'utf-8')
    },

    async listDir(relPath) {
      const absolute = resolveSafe(resolvedRoot, relPath)
      await verifyRealPath(resolvedRoot, absolute)
      const entries = await readdir(absolute, { withFileTypes: true })
      return entries.map((e) => ({ name: e.name, isDir: e.isDirectory() }))
    },

    async stat(relPath) {
      const absolute = resolveSafe(resolvedRoot, relPath)
      await verifyRealPath(resolvedRoot, absolute)
      const info = await stat(absolute)
      return { size: info.size, isDir: info.isDirectory(), modified: info.mtimeMs }
    },
  }
}

function guessMime(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    pdf: 'application/pdf',
  }
  return map[ext] ?? 'application/octet-stream'
}

// —— Shell API ——

export function buildShellApi(): ToolShellApi {
  return {
    async exec(command, options = {}) {
      const timeout = options.timeoutMs ?? DEFAULT_SHELL_TIMEOUT
      try {
        const { stdout, stderr } = await execFileAsync(command, [], {
          timeout,
          encoding: 'utf-8',
          maxBuffer: MAX_SHELL_OUTPUT,
          shell: false,
        })
        return {
          stdout: truncate(stdout),
          stderr: truncate(stderr),
          exitCode: 0,
        }
      } catch (error: unknown) {
        const e = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string; code?: number }
        return {
          stdout: truncate(e.stdout ?? ''),
          stderr: truncate(e.stderr ?? e.message ?? String(error)),
          exitCode: typeof e.code === 'number' ? e.code : -1,
        }
      }
    },
  }
}

function truncate(text: string): string {
  if (text.length <= MAX_SHELL_OUTPUT) return text
  return `${text.slice(0, MAX_SHELL_OUTPUT)}…（已截断）`
}
