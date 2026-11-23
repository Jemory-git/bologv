/**
 * 具体工具的 Provider。对应真实仓库 packages/fs/*、packages/shell/* 下的工具包。
 *
 * 这个插件只做一件事：向注册表登记工具。它不关心谁调用、也不关心模型是谁。
 * 文件工具的沙箱根目录（rootDir）由组合层经 config 注入，包内不读取 process.cwd()。
 */

import { readFile, realpath, stat } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import type { PluginObject } from '@pkg/cordis'
import { TOOLS_SERVICE_NAME, type Tool, type ToolRegistry } from './types.ts'

const MAX_OUTPUT_CHARS = 2000
const MAX_FILE_BYTES = 1024 * 1024

/** target 是否位于 root 之内（含 root 自身）。 */
function isInside(root: string, target: string): boolean {
  const rel = relative(root, target)
  return rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)
}

function createReadFileTool(rootDir: string): Tool {
  return {
    name: 'read_file',
    description: '读取工作目录内的文本文件，返回截断后的内容',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: '相对工作目录的文件路径' } },
      required: ['path'],
    },
    async run(args) {
      const path = String(args.path ?? '')
      const absolute = resolve(rootDir, path)
      if (!isInside(rootDir, absolute)) throw new Error('path escapes working directory')
      // 解析符号链接后再校验一次，防止链接把读取带出沙箱。
      const realFile = await realpath(absolute)
      if (!isInside(await realpath(rootDir), realFile)) throw new Error('path escapes working directory')
      const { size } = await stat(realFile)
      if (size > MAX_FILE_BYTES) throw new Error(`file too large: ${size} bytes (max ${MAX_FILE_BYTES})`)
      const text = await readFile(realFile, 'utf8')
      return text.length > MAX_OUTPUT_CHARS ? `${text.slice(0, MAX_OUTPUT_CHARS)}…（已截断）` : text
    },
  }
}

const nowTool: Tool = {
  name: 'now',
  description: '返回当前本地时间（ISO 8601，带时区偏移）',
  parameters: { type: 'object', properties: {} },
  run() {
    const now = new Date()
    const pad = (n: number): string => String(n).padStart(2, '0')
    const offsetMinutes = -now.getTimezoneOffset()
    const sign = offsetMinutes >= 0 ? '+' : '-'
    const abs = Math.abs(offsetMinutes)
    const offset = `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}${offset}`
  },
}

export const builtinToolsPlugin: PluginObject = {
  name: 'builtin-tools',
  inject: [TOOLS_SERVICE_NAME],
  apply(ctx, config) {
    const rootDir = config?.rootDir
    if (typeof rootDir !== 'string' || rootDir === '') {
      throw new Error('builtin-tools: config.rootDir is required')
    }
    const registry = ctx.require<ToolRegistry>(TOOLS_SERVICE_NAME)
    registry.register(createReadFileTool(rootDir))
    registry.register(nowTool)
  },
}
