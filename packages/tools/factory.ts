/**
 * Tool 运行时能力工厂：构造 ToolFsApi / ToolShellApi。
 *
 * 所有能力都有沙箱/安全约束：
 *   - fs：只允许读写 rootDir 之内，超出路径直接报错
 *   - shell：以 rootDir 为工作目录执行，默认 30s 超时，输出截断 20KB
 */

import { isAbsolute, relative, resolve, sep } from 'node:path'
import { execFile } from 'node:child_process'
import { readFile, realpath, stat, writeFile, mkdir, readdir } from 'node:fs/promises'
import { promisify } from 'node:util'
import type { ToolFsApi, ToolShellApi } from './types.ts'

const MAX_FILE_BYTES = 2 * 1024 * 1024   // 2MB
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
      // 不做字符截断：截断属于「给模型看什么」，由各工具按自己的行数/字数预算处理；
      // 能力层截断会悄悄破坏 grep 与 edit 的完整性。
      return readFile(absolute, 'utf-8')
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

/** execFile 的失败对象：spawn 级失败只有字符串 code，进程级失败才有数字 code。 */
type ExecFailure = NodeJS.ErrnoException & {
  stdout?: Buffer
  stderr?: Buffer
  killed?: boolean
  code?: string | number
}

export function buildShellApi(cwd: string): ToolShellApi {
  return {
    async exec(command, options = {}) {
      const timeout = options.timeoutMs ?? DEFAULT_SHELL_TIMEOUT
      try {
        // shell: true —— 命令整体交给系统 shell 解释，支持管道、重定向、&& 与带引号的参数。
        // cwd —— 与 fs 沙箱同根，模型在 shell 与 fs 工具中看到的是同一个坐标系。
        // encoding: 'buffer' —— 输出编码由 decodeOutput 判断，不预设 UTF-8。
        const { stdout, stderr } = await execFileAsync(command, {
          timeout,
          cwd,
          encoding: 'buffer',
          maxBuffer: MAX_SHELL_OUTPUT,
          shell: true,
          windowsHide: true,
        })
        return { stdout: truncate(decodeOutput(stdout)), stderr: truncate(decodeOutput(stderr)), exitCode: 0 }
      } catch (error: unknown) {
        const e = error as ExecFailure
        // 字符串 code 表示进程根本没起来（命令不存在、无执行权限）：
        // 这不是「命令执行失败」，而是工具能力失败，必须抛错让模型换做法，而非伪装成 exit code。
        if (typeof e.code === 'string') {
          throw new Error(`命令无法启动（${e.code}）：${e.message}`)
        }
        // 非零退出码与超时终止都算「跑完了但有结果」，连同输出一起回灌。
        const stderr = e.killed === true
          ? `命令超时（${timeout}ms）被终止`
          : decodeOutput(e.stderr ?? Buffer.alloc(0)) || e.message
        return {
          stdout: truncate(decodeOutput(e.stdout ?? Buffer.alloc(0))),
          stderr: truncate(stderr),
          exitCode: typeof e.code === 'number' ? e.code : -1,
        }
      }
    },
  }
}

/**
 * 解码命令输出：先按 UTF-8 严格解码，失败则按 GBK 解码。
 *
 * Windows 控制台命令按本地代码页输出（中文系统为 GBK），而跨平台工具（git 等）通常输出 UTF-8；
 * 预设任一种都会让另一类变成乱码。严格 UTF-8 失败即回退，覆盖两种现实。
 */
function decodeOutput(buffer: Buffer): string {
  if (buffer.length === 0) return ''
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    try {
      return new TextDecoder('gbk').decode(buffer)
    } catch {
      return buffer.toString('utf-8')
    }
  }
}

function truncate(text: string): string {
  if (text.length <= MAX_SHELL_OUTPUT) return text
  return `${text.slice(0, MAX_SHELL_OUTPUT)}…（已截断）`
}
