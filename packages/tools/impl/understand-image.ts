/**
 * understand_image —— 理解图片内容（只读，不修改、不生成图片）。
 *
 * 经 ctx.referenceReader 读图（任意绝对路径），调「能读图的对话模型」返回文字描述。
 * 模型需求是 language + image 输入：image 类别是图像生成模型，不能用来理解图片。
 * 供无读图能力的主模型使用；结果作为 tool/result 记录，不可变。
 * 历史压缩后可传快照路径（snapshotPath）取回原图再理解。
 */

import type { ToolFactory } from '../types.ts'

export const understandImage: ToolFactory = (ctx) => ({
  name: 'understand_image',
  description:
    '读取并理解指定绝对路径的图片，返回文字描述。仅能「看懂」图片，不能修改、编辑或生成图片；。可选 question 指定想了解的问题。',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '图片绝对路径' },
      question: { type: 'string', description: '可选。想了解的关于图片的问题；留空则整体描述' },
    },
    required: ['path'],
  },
  // 框架级：与 read_file 对称——引用文件中的图片随时可能被问及，确保模型随时能看，
  // 否则每条带图消息都要先花一轮 query_capabilities 激活。
  disableable: false,
  favoriteEditable: false,
  fixedFavorite: true,
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
      image = await ctx.referenceReader.readImage2B64(path)
    } catch (error) {
      return error instanceof Error ? error.message : String(error)
    }
    if (image === null) return `图片不可读取：${path}`

    const model = await ctx.pickModel({ category: 'language', inputModality: 'image' })
    if (model === undefined) {
      return '当前已配置的模型中没有能读图的对话模型（需类别 language 且输入模态含 image），无法理解图片。请前往【设置->配置模型】添加此类模型。'
    }

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
