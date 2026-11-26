/**
 * search_file —— 在工作目录内按关键词搜索文件内容。
 *
 * 工厂函数：构造时注入 ctx，run 通过闭包使用 ctx.fs。
 */

import type { ToolFactory } from '../types.ts'

const MAX_RESULTS = 20

export const searchFile: ToolFactory = (ctx) => ({
  name: 'search_file',
  description: '在工作目录内递归搜索文件内容。适合定位包含特定关键词的文件。',
  parameters: {
    type: 'object',
    properties: {
      keyword: { type: 'string', description: '要搜索的关键词' },
      pattern: { type: 'string', description: '可选。glob 过滤，如 "*.ts"、"src/**/*.ts"' },
      maxResults: { type: 'integer', description: `可选。最多返回多少条结果（默认 ${MAX_RESULTS}）` },
    },
    required: ['keyword'],
  },
  async run(args) {
    if (!ctx.fs) {
      return 'Tool 未配置文件系统能力'
    }
    const keyword = String(args.keyword ?? '').trim()
    if (!keyword) return 'keyword 不能为空'

    const maxResults = Math.min(Number(args.maxResults ?? MAX_RESULTS), 50)
    const pattern = typeof args.pattern === 'string' ? args.pattern : undefined

    const results: string[] = []
    await walkAndSearch(ctx.fs, '', keyword, pattern, maxResults, results)

    if (results.length === 0) return `未找到包含 "${keyword}" 的文件`
    return results.join('\n')
  },
})

async function walkAndSearch(
  fs: NonNullable<import('../types.ts').ToolRunContext['fs']>,
  dir: string,
  keyword: string,
  pattern: string | undefined,
  maxResults: number,
  results: string[],
): Promise<void> {
  if (results.length >= maxResults) return
  let entries: { name: string; isDir: boolean }[]
  try {
    entries = await fs.listDir(dir)
  } catch {
    return
  }

  for (const entry of entries) {
    if (results.length >= maxResults) return
    const rel = dir ? `${dir}/${entry.name}` : entry.name
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name.startsWith('.')) continue

    if (entry.isDir) {
      await walkAndSearch(fs, rel, keyword, pattern, maxResults, results)
    } else {
      if (pattern && !matchGlob(entry.name, pattern)) continue
      try {
        const text = await fs.readText(rel)
        if (text.toLowerCase().includes(keyword.toLowerCase())) {
          // 截取首次出现位置前后 50 字符作为上下文
          const idx = text.toLowerCase().indexOf(keyword.toLowerCase())
          const start = Math.max(0, idx - 50)
          const end = Math.min(text.length, idx + keyword.length + 50)
          results.push(`${rel}: ...${text.slice(start, end)}...`)
        }
      } catch {
        // 二进制文件或超限文件，跳过
      }
    }
  }
}

// 极简 glob：只支持 *.ext 和 double-star-slash 前缀。
function matchGlob(name: string, pattern: string): boolean {
  const base = pattern.replace(/^\*\*\/(.*)$/, '$1')
  if (base.startsWith('*.')) {
    const ext = base.slice(1) // .ext
    return name.toLowerCase().endsWith(ext.toLowerCase())
  }
  return name.toLowerCase() === base.toLowerCase()
}
