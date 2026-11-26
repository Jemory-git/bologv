/**
 * read_file —— 读取任意绝对路径的文档内容（统一入口，内部按类型分派）。
 *
 * 经 ctx.referenceReader 读取（复用 references 校验规则，不受工具 fs 沙箱约束）。
 * 文本类文档返回 UTF-8 文本；暂不支持的格式（如 pdf/docx）返回说明，留解析器接缝。
 * 内容作为 tool/result 记录，不可变——原文件后续变更不影响历史。
 */

import type { ToolFactory } from '../types.ts'

export const readFile: ToolFactory = (ctx) => ({
  name: 'read_file',
  description:
    '读取指定绝对路径的文档内容。支持文本类文档：txt、md、json、csv、tsv、html、xml、yaml、css 及常见代码文件（ts/js/py/go/rs/java 等）。pdf/word 等暂不支持。用户消息中的参考文件以路径给出时，用此工具读取。',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '要读取的文档绝对路径' },
    },
    required: ['path'],
  },
  // 框架级：始终启用、强制 favorite，确保模型随时能读引用文档。
  disableable: false,
  favoriteEditable: false,
  fixedFavorite: true,
  async run(args) {
    if (!ctx.referenceReader) return 'Tool 未配置参考文件读取能力'
    const path = String(args.path ?? '').trim()
    if (!path) return 'path 不能为空'
    try {
      const text = await ctx.referenceReader.readText(path)
      return text === null ? `文件不可读取：${path}` : text
    } catch (error) {
      return error instanceof Error ? error.message : String(error)
    }
  },
})
