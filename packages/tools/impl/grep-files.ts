/**
 * grep_files —— 在工作目录内按内容检索文本文件，返回「相对路径:行号: 内容」。
 *
 * 只做「按内容找」：文件名匹配交给 include 过滤，按名字定位文件用 find_files。
 * 跳过二进制文件与读不动的超限文件，避免把乱码或错误塞给模型。
 */

import { globMatcher } from '../glob.ts'
import type { ToolFactory } from '../types.ts'
import { walkFiles } from '../walk.ts'

const DEFAULT_MAX_RESULTS = 50
const HARD_MAX_RESULTS = 200
const MAX_LINE_CHARS = 200

export const grepFiles: ToolFactory = (ctx) => ({
  name: 'grep_files',
  description:
    '在工作目录的文本文件中按内容检索，返回「相对路径:行号: 命中行内容」。pattern 是正则表达式（区分大小写），要按字面匹配含特殊字符的文本请自行转义；include 可用 glob 限定文件类型（如 "*.ts"）。跳过 node_modules、.git、点开头的隐藏文件、二进制与超过 2MB 的文件。只看文件名请用 find_files。',
  parameters: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: '正则表达式（JavaScript 语法），如 "TODO|FIXME"' },
      include: { type: 'string', description: '可选。文件名 glob 过滤，如 "*.ts"；不支持花括号语法，多种类型请分多次搜索' },
      path: { type: 'string', description: '可选。限定搜索的子目录（相对于工作目录）' },
      maxResults: { type: 'integer', description: `可选。最多返回多少条命中（默认 ${DEFAULT_MAX_RESULTS}，上限 ${HARD_MAX_RESULTS}）` },
    },
    required: ['pattern'],
  },
  async run(args) {
    const fs = ctx.fs
    if (!fs) return 'Tool 未配置文件系统能力'

    const source = String(args.pattern ?? '').trim()
    if (!source) return 'pattern 不能为空'

    let regex: RegExp
    try {
      regex = new RegExp(source)
    } catch (error) {
      return `正则表达式无效：${error instanceof Error ? error.message : String(error)}`
    }

    const include = typeof args.include === 'string' && args.include.trim() !== ''
      ? globMatcher(args.include)
      : undefined
    const scope = typeof args.path === 'string' ? args.path.trim() : ''
    const maxResults = clampMaxResults(Number(args.maxResults ?? DEFAULT_MAX_RESULTS))

    const results: string[] = []
    await walkFiles(fs, scope, async (relPath) => {
      if (include !== undefined && !include(relPath)) return true

      const text = await fs.readText(relPath).catch(() => null)
      // 读不动（超限、权限）或二进制（UTF-8 解码后仍含 NUL）直接跳过。
      if (text === null || text.includes('\u0000')) return true

      const lines = text.split(/\r?\n/)
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i] ?? ''
        if (!regex.test(line)) continue
        results.push(`${relPath}:${i + 1}: ${trimLine(line)}`)
        if (results.length >= maxResults) return false
      }
      return true
    })

    if (results.length === 0) return `工作目录下没有匹配 "${source}" 的内容`
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

function trimLine(line: string): string {
  const trimmed = line.trim()
  return trimmed.length > MAX_LINE_CHARS ? `${trimmed.slice(0, MAX_LINE_CHARS)}…` : trimmed
}
