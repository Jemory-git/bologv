/**
 * write_file —— 在工作目录内新建文件或整体覆盖写入。
 *
 * 覆盖保护：文件已存在时必须先用 read_file 读过它，否则拒绝。
 * 读取记录由组合根注入的 hasReadFile 提供（源自本会话事件日志），工具层不持有会话状态。
 */

import { resolve } from 'node:path'
import type { ToolFactory } from '../types.ts'

export const writeFile: ToolFactory = (ctx) => ({
  name: 'write_file',
  description:
    '在工作目录内新建文件或整体覆盖写入文本内容（UTF-8，父目录自动创建）。覆盖已存在的文件前必须先 read_file 读取过它，否则会被拒绝；只修改局部内容请用 edit_file。',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '文件路径（相对工作目录）' },
      content: { type: 'string', description: '完整文件内容；传空串表示清空文件' },
    },
    required: ['path', 'content'],
  },
  async run(args) {
    const fs = ctx.fs
    if (!fs) return 'Tool 未配置文件系统能力'

    const path = String(args.path ?? '').trim()
    if (!path) return 'path 不能为空'
    if (typeof args.content !== 'string') return 'content 必须是字符串'

    const exists = await fs.stat(path).then(() => true).catch(() => false)
    if (exists && ctx.hasReadFile !== undefined && !(await ctx.hasReadFile(resolve(fs.rootDir, path)))) {
      return `拒绝覆盖 ${path}：覆盖已存在的文件前必须先用 read_file 读取它，以免丢失未读内容；只想改局部内容请用 edit_file。`
    }

    try {
      await fs.writeText(path, args.content)
    } catch (error) {
      return error instanceof Error ? error.message : String(error)
    }
    return `${exists ? '已覆盖' : '已创建'} ${path}（${args.content.length} 字符）`
  },
})
