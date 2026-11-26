/**
 * understand_image —— 理解图片内容。
 *
 * 经 ctx.referenceReader 读图（任意绝对路径），调视觉模型（pickModel('image')）返回文字描述。
 * 供无读图能力的主模型使用；结果作为 tool/result 记录，不可变。
 * 历史压缩后可传快照路径（snapshotPath）取回原图再理解。
 */

import type { ToolFactory } from '../types.ts'

export const understandImage: ToolFactory = (ctx) => ({
  name: 'understand_image',
  description:
    '理解指定绝对路径的图片内容，返回文字描述。需要看懂图片时调用。可选 question 指定想了解的问题。',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '图片绝对路径' },
      question: { type: 'string', description: '可选。想了解的关于图片的问题；留空则整体描述' },
    },
    required: ['path'],
  },
  preferredModelCategory: 'image',
  async run(args) {
    if (!ctx.referenceReader) return 'Tool 未配置参考文件读取能力'
    const path = String(args.path ?? '').trim()
    if (!path) return 'path 不能为空'
    const question =
      typeof args.question === 'string' && args.question.trim() !== ''
        ? args.question.trim()
        : '请描述这张图片的内容。'

    let image: { mime: string; data: string } | null
    try {
      image = await ctx.referenceReader.readImage(path)
    } catch (error) {
      return error instanceof Error ? error.message : String(error)
    }
    if (image === null) return `图片不可读取：${path}`

    const model = await ctx.pickModel('image')
    if (model === undefined) return '未配置可用的视觉模型，无法理解图片'

    const result = await ctx.llm.chat({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', mimeType: image.mime, data: image.data },
            { type: 'text', text: question },
          ],
        },
      ],
      tools: [],
      model,
    })
    return result.kind === 'text' ? result.text : '视觉模型未返回文字描述'
  },
})
