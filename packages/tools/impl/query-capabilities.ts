/**
 * query_capabilities —— 目录浏览元工具。
 *
 * 和其他 tool 一样是普通工厂，无特殊构造：通过 ctx.tools（注册表只读视图）枚举能力，
 * 正如 grep_files 通过 ctx.fs 访问文件系统。
 *
 * LLM 用它发现当前环境有哪些可用能力。filter 为空返回全部非 favorite 工具；
 * 有值时按关键词过滤。语义理解由 LLM 自己完成（读 description 后推理），服务端只做关键词匹配。
 *
 * 返回的 data.discoveredTools 是「发现协议」的载体：发现投影据此把工具累积进本会话可调用集合。
 */

import { DISCOVERED_TOOLS_DATA_KEY, QUERY_CAPABILITIES_TOOL_NAME, type Tool, type ToolFactory } from '../types.ts'

export const queryCapabilities: ToolFactory = (ctx) => ({
  name: QUERY_CAPABILITIES_TOOL_NAME,
  description:
    '查询并激活当前环境的工具。本轮 tools 参数已声明的工具直接调用，无需查询；需要工具目录中列出但本轮未声明的工具，或不确定环境是否具备某种能力时，先调用本工具查询激活，命中的工具下一轮起可直接调用。',
  parameters: {
    type: 'object',
    properties: {
      filter: {
        type: 'string',
        description:
          '可选。过滤关键词：在工具名与描述中做子串匹配（非语义检索），用短词而非整句，中英文均可，如 "image"、"图片"、"file"、"search"、"命令"。多个关键词用空格或逗号分隔，命中任一即返回。留空返回全部可激活工具（每轮必带的除外）。',
      },
    },
  },
  // 框架级约束：始终启用、强制 favorite（每轮必带），用户不可禁用或改 favorite。
  disableable: false,
  favoriteEditable: false,
  fixedFavorite: true,
  run(args) {
    const filter = typeof args.filter === 'string' ? args.filter.trim() : ''
    // 排除 favorite（每轮都已下发，含本工具自身），避免重复展示。
    const pool = ctx.tools.list().filter((t) => !ctx.tools.isFavorite(t.name))
    const matched = filter ? filterByKeyword(pool, filter) : pool
    const names = matched.map((t) => t.name)
    // 两面结果：content 给模型摘要与下一步指引；data.discoveredTools 供发现投影累积本会话工具。
    // 完整 schema 由 agent-loop 下一轮随 tools 参数下发，不在结果里重复。
    const content =
      names.length > 0
        ? `已检索到 ${names.length} 个工具（${names.join('、')}），下一轮起可直接调用。命中仅表示关键词相关，是否满足需求请核对工具描述；没有合适的就如实告诉用户不具备该能力。`
        : '未检索到匹配的工具。可换更短、更泛的关键词（如 "file"、"image"）重试，或留空 filter 查看全部可激活工具。'
    return {
      content,
      data: { [DISCOVERED_TOOLS_DATA_KEY]: names },
    }
  },
})

function filterByKeyword(tools: Tool[], filter: string): Tool[] {
  const kws = filter.toLowerCase().split(/[\s,，]+/).filter(Boolean)
  if (kws.length === 0) return tools
  return tools.filter((t) => {
    const hay = `${t.name} ${t.description}`.toLowerCase()
    return kws.some((k) => hay.includes(k))
  })
}
