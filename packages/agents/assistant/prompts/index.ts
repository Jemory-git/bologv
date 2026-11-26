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

// —— 类型 ——

/** 构建输入：当前启用的工具列表（工具目录的唯一事实源）。 */
export interface SystemPromptInput {
  tools: readonly Tool[]
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
    toolCatalog: renderToolCatalog(input.tools),
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

/** 工具目录：纯列表（名称 + 描述），不带标题、不带 schema、不标记 favorite。 */
function renderToolCatalog(tools: readonly Tool[]): string {
  return tools.map((tool) => `- ${tool.name}：${tool.description}`).join('\n')
}
