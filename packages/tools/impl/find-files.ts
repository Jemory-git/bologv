/**
 * find_files —— 按文件名/路径模式（glob）在工作目录内定位文件。
 *
 * 只做「找文件」：不读内容、不判断内容相关性。
 * 与 grep_files 的分工是硬边界——按名字找用本工具，按内容找用 grep_files。
 */

import { globMatcher } from '../glob.ts'
import type { ToolFactory } from '../types.ts'
import { walkFiles } from '../walk.ts'

const DEFAULT_MAX_RESULTS = 200
const HARD_MAX_RESULTS = 1000

export const findFiles: ToolFactory = (ctx) => ({
  name: 'find_files',
  description:
    '按文件名或路径模式（glob）在工作目录中定位文件，返回相对路径与文件大小；不读取、不匹配文件内容。模式不含 "/" 时按文件名匹配任意层级（如 "*.ts"），含 "/" 时按相对路径整体匹配（如 "src/**/*.vue"）。跳过 node_modules、.git 与点开头的隐藏文件。只搜内容请用 grep_files。',
  parameters: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'glob 模式，如 "*.md"、"src/**/*.ts"' },
      path: { type: 'string', description: '可选。限定搜索的子目录（相对于工作目录）' },
      maxResults: { type: 'integer', description: `可选。最多返回多少条（默认 ${DEFAULT_MAX_RESULTS}，上限 ${HARD_MAX_RESULTS}）` },
    },
    required: ['pattern'],
  },
  async run(args) {
    const fs = ctx.fs
    if (!fs) return 'Tool 未配置文件系统能力'

    const pattern = String(args.pattern ?? '').trim()
    if (!pattern) return 'pattern 不能为空'
    const scope = typeof args.path === 'string' ? args.path.trim() : ''
    const maxResults = clampMaxResults(Number(args.maxResults ?? DEFAULT_MAX_RESULTS))

    const matches = globMatcher(pattern)
    const results: string[] = []
    await walkFiles(fs, scope, async (relPath) => {
      if (matches(relPath)) {
        const info = await fs.stat(relPath).catch(() => null)
        results.push(info === null ? relPath : `${relPath} (${formatSize(info.size)})`)
      }
      return results.length < maxResults
    })

    if (results.length === 0) return `工作目录下没有匹配 "${pattern}" 的文件`
    const body = results.join('\n')
    return results.length >= maxResults
      ? `${body}\n（已达到 ${maxResults} 条上限，可用更精确的 pattern 或 path 缩小范围）`
      : body
  },
})

function clampMaxResults(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_MAX_RESULTS
  return Math.min(Math.trunc(value), HARD_MAX_RESULTS)
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
