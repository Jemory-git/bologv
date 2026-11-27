/**
 * System prompt 构建器：把若干 .md 段插值后拼成 static / dynamic 两部分。
 *
 * - static：身份、工具规则、行为准则 —— 跨请求不变，利于模型侧前缀缓存。
 * - dynamic：运行环境、工具目录 —— 随请求变化，排在 static 之后。
 *
 * 每个 .md 段用 {{marker}} 占位，运行时由 interpolate 统一插值；未知 marker 抛错。
 * 返回两部分而非单一字符串，是给 loop 留接缝：未来可调整 dynamic 的摆放位置。
 */

import identity from './identity.md'
import toolPolicy from './tool-policy.md'
import behavior from './behavior.md'
import environment from './environment.md'
import toolCatalog from './tool-catalog.md'

import type { Tool } from '@pkg/tools'
import { QUERY_CAPABILITIES_TOOL_NAME } from '@pkg/tools'

// —— 类型 ——

/**
 * 构建输入：工具分两份视图。
 *
 * - callable：本轮 tools 参数中已下发、模型可直接调用；
 * - catalog：已启用的全部工具，用于让模型知道能力范围。
 *
 * 分开传入而不是传一份再附加集合，是因为工具目录要按这两组分别渲染——
 * 模型看到「目录里有但调不了」正是乱调未激活工具的根因。
 */
export interface SystemPromptInput {
  callable: readonly Tool[]
  catalog: readonly Tool[]
  /** 工作目录：文件类工具的相对路径基准，模型必须知道它在哪。 */
  workingDir: string
}

/** 构建产物：静态段与动态段分开返回，由消费方决定如何摆放。 */
export interface SystemPromptParts {
  static: string
  dynamic: string
}

// —— 构建 ——

export function buildSystemPrompt(input: SystemPromptInput): SystemPromptParts {
  const values: Record<string, string> = {
    platform: process.platform,
    today: new Date().toISOString().slice(0, 10),
    workingDir: input.workingDir,
    toolCatalog: renderToolCatalog(input),
  }
  const render = (sections: readonly string[]): string =>
    sections.map((section) => interpolate(section, values)).join('\n\n')

  return {
    static: render([identity, toolPolicy, behavior]),
    dynamic: render([environment, toolCatalog]),
  }
}

// —— 辅助 ——

/** 把 {{marker}} 替换为对应值；未知 marker 抛错，避免静默漏填。 */
function interpolate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = values[key]
    if (value === undefined) throw new Error(`unknown system prompt marker: ${key}`)
    return value
  })
}

/**
 * 工具目录：按「本轮可直接调用」「需先激活」分组渲染，每组只列名称 + 描述。
 *
 * 分组就是模型要遵守的可调用边界，让它不必再靠记忆去对齐 tools 参数；
 * 第二组为空时不输出空标题。
 */
function renderToolCatalog(input: SystemPromptInput): string {
  const callableNames = new Set(input.callable.map((tool) => tool.name))
  const ready = input.catalog.filter((tool) => callableNames.has(tool.name))
  const pending = input.catalog.filter((tool) => !callableNames.has(tool.name))

  const sections = [`本轮可直接调用：\n${renderToolLines(ready)}`]
  if (pending.length > 0) {
    sections.push(`需先调用 ${QUERY_CAPABILITIES_TOOL_NAME} 激活后才能调用：\n${renderToolLines(pending)}`)
  }
  return sections.join('\n\n')
}

function renderToolLines(tools: readonly Tool[]): string {
  return tools.map((tool) => `- ${tool.name}：${tool.description}`).join('\n')
}
