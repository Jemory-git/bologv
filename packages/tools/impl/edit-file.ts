/**
 * edit_file —— 对工作目录内的文本文件做精确字符串替换。
 *
 * 约束是刻意的：oldString 必须唯一命中，否则拒绝并说明原因。
 * 读-改-写三步都在本工具内完成，模型只需给出「替换前 / 替换后」两段文本。
 */

import type { ToolFactory } from '../types.ts'

export const editFile: ToolFactory = (ctx) => ({
  name: 'edit_file',
  description:
    '对工作目录内的文本文件做精确字符串替换：oldString 必须与文件内容逐字符一致（含缩进与换行）且在文件中唯一出现；newString 是替换后的内容。改局部内容用它，整体重写用 write_file，新建文件用 write_file。',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '文件路径（相对工作目录）' },
      oldString: { type: 'string', description: '要被替换的原文片段，必须唯一命中' },
      newString: { type: 'string', description: '替换后的内容；传空串表示删除该片段' },
    },
    required: ['path', 'oldString', 'newString'],
  },
  async run(args) {
    const fs = ctx.fs
    if (!fs) return 'Tool 未配置文件系统能力'

    const path = String(args.path ?? '').trim()
    if (!path) return 'path 不能为空'
    if (typeof args.oldString !== 'string' || args.oldString === '') return 'oldString 不能为空'
    if (typeof args.newString !== 'string') return 'newString 必须是字符串'

    const exists = await fs.stat(path).then(() => true).catch(() => false)
    if (!exists) return `${path} 不存在；新建文件请用 write_file`

    let text: string
    try {
      text = await fs.readText(path)
    } catch (error) {
      return error instanceof Error ? error.message : String(error)
    }

    const first = text.indexOf(args.oldString)
    if (first === -1) {
      return `未在 ${path} 中找到 oldString。请先用 read_file 确认原文，oldString 必须与文件内容逐字符一致（包括缩进、空格与换行）。`
    }
    if (text.indexOf(args.oldString, first + args.oldString.length) !== -1) {
      return `oldString 在 ${path} 中出现多次，无法确定替换位置。请把 oldString 扩大到足以唯一命中的上下文。`
    }

    const updated = `${text.slice(0, first)}${args.newString}${text.slice(first + args.oldString.length)}`
    try {
      await fs.writeText(path, updated)
    } catch (error) {
      return error instanceof Error ? error.message : String(error)
    }

    const line = text.slice(0, first).split(/\r?\n/).length
    return `已修改 ${path}（第 ${line} 行）`
  },
})
