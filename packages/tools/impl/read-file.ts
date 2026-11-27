/**
 * read_file —— 读取文本文件内容，按行号返回片段。
 *
 * 两条读取路线，由路径形态决定，模型无需额外参数：
 *   - 绝对路径：走 ctx.referenceReader，读本机任意位置的文档（参考文件就是绝对路径）；
 *   - 相对路径：走 ctx.fs，读工作目录内的文件（find_files/grep_files 返回的是相对路径）。
 * 分段读取：默认前 400 行，offset 续读，避免大文件一次性灌满上下文。
 * 内容作为 tool/result 记录，不可变——原文件后续变更不影响历史。
 */

import { isAbsolute } from 'node:path'
import type { ToolFactory, ToolRunContext } from '../types.ts'

const DEFAULT_LIMIT = 400
const HARD_LIMIT = 2000
/** 单次输出字符预算：行数上限之外的第二道闸，防止超长行撑爆上下文。 */
const MAX_OUTPUT_CHARS = 16_000

type ReadOutcome = { text: string } | { error: string }

export const readFile: ToolFactory = (ctx) => ({
  name: 'read_file',
  description:
    '读取文本文件，返回带行号的片段。路径为绝对路径时读取本机任意位置的文档（参考文件用此法）；为相对路径时读取工作目录内的文件（find_files/grep_files 返回的就是相对路径）。默认从第 1 行起返回 400 行；文件更长时按返回末尾提示的 offset 续读。',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '文件路径：工作目录内用相对路径，其他位置用绝对路径' },
      offset: { type: 'integer', description: '可选。起始行号，从 1 开始（默认 1）' },
      limit: { type: 'integer', description: `可选。本次最多读取的行数（默认 ${DEFAULT_LIMIT}，上限 ${HARD_LIMIT}）` },
    },
    required: ['path'],
  },
  // 框架级：始终启用、强制 favorite，确保模型随时能读引用文档与工作目录文件。
  disableable: false,
  favoriteEditable: false,
  fixedFavorite: true,
  async run(args) {
    const path = String(args.path ?? '').trim()
    if (!path) return 'path 不能为空'

    const outcome = await readByPath(ctx, path)
    if ('error' in outcome) return outcome.error
    if (outcome.text === '') return `文件为空：${path}`

    const lines = outcome.text.split(/\r?\n/)
    // 结尾换行产生的空串不计入行数，避免多报一行。
    const total = lines.at(-1) === '' ? lines.length - 1 : lines.length

    const rawOffset = Number(args.offset ?? 1)
    const offset = Number.isFinite(rawOffset) && rawOffset >= 1 ? Math.trunc(rawOffset) : 1
    if (offset > total) return `offset 超出文件行数：共 ${total} 行`

    const rawLimit = Number(args.limit ?? DEFAULT_LIMIT)
    const limit = Number.isFinite(rawLimit) && rawLimit >= 1
      ? Math.min(Math.trunc(rawLimit), HARD_LIMIT)
      : DEFAULT_LIMIT
    const slice = lines.slice(offset - 1, offset - 1 + limit)
    const width = String(offset + slice.length - 1).length

    let body = ''
    let shown = 0
    for (const line of slice) {
      const rendered = `${String(offset + shown).padStart(width)}| ${line}`
      if (body.length + rendered.length + 1 > MAX_OUTPUT_CHARS) {
        // 极端情况：首行本身就超过字符预算，至少给出截断后的第一行，避免返回空内容。
        if (shown === 0) {
          body = `${rendered.slice(0, MAX_OUTPUT_CHARS)}…\n`
          shown = 1
        }
        break
      }
      body += `${rendered}\n`
      shown += 1
    }

    const lastShown = offset + shown - 1
    if (lastShown >= total) return body.trimEnd()
    return `${body.trimEnd()}\n（文件共 ${total} 行，本次显示第 ${offset}-${lastShown} 行；继续读取请传 offset=${lastShown + 1}）`
  },
})

/** 按路径形态选择读取能力；错误转成模型可读文案，不向上抛。 */
async function readByPath(ctx: ToolRunContext, path: string): Promise<ReadOutcome> {
  if (isAbsolute(path)) {
    if (!ctx.referenceReader) return { error: 'Tool 未配置参考文件读取能力' }
    try {
      const text = await ctx.referenceReader.readText(path)
      return text === null ? { error: `文件不可读取（不存在、非文本或为空）：${path}` } : { text }
    } catch (error) {
      return { error: message(error) }
    }
  }

  if (!ctx.fs) return { error: 'Tool 未配置文件系统能力' }
  const fs = ctx.fs
  try {
    return { text: await fs.readText(path) }
  } catch (error) {
    return { error: message(error) }
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
