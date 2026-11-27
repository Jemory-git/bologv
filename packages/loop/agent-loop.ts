/**
 * 编排循环：请求 → 工具 → 回灌。
 *
 * 工具下发策略：
 *   - favorite（用户标记常用，含强制 favorite 的 query_capabilities）每轮必带
 *   - 会话 discovered：从本会话事件投影累积（tool/result.data.discoveredTools），
 *     跨轮持久、会话隔离、重启可恢复——不在单例里持有跨会话状态
 *   - MAX_SEND_TOOLS 暂设极大值，不截断
 *   - 执行门禁：只执行本轮已下发的工具，未下发的调用回灌激活指引——
 *     「模型可调用 ⟺ 本轮已下发」，与发现协议保持一致
 *
 * 工具执行完全通用：run 返回 string 或 {content, data}，原样记入 tool/result，
 * 不认识任何具体工具；发现等结构化副产物由投影消费。
 */

import type { PluginObject } from '@pkg/cordis'
import {
  CHECKPOINT_SERVICE_NAME,
  SESSION_MANAGER_SERVICE_NAME,
  type CheckpointService,
  type ReferenceMeta,
  type SessionEvent,
  type SessionManager,
} from '@pkg/session'
import { LLM_SERVICE_NAME } from '@pkg/models/language/types.ts'
import type { ChatMessage, LLMResult, LLMService } from '@pkg/models/language/types.ts'
import { DISCOVERED_TOOLS_DATA_KEY, QUERY_CAPABILITIES_TOOL_NAME, TOOLS_SERVICE_NAME, type Tool, type ToolRegistry } from '@pkg/tools'
import { toChatMessages, type ImageEmbedParts } from './chat-projection.ts'

/** 一次用户输入：文本可以为空，但文本与引用不能同时为空。 */
export interface AgentInput {
  text: string
  references?: readonly ReferenceMeta[]
}

/**
 * 图片内嵌提供者：把历史里的图片引用（capable 模型）从快照读成多模态片段。
 * 文档不内嵌，由模型调工具读取。由组合根注入；未注入则全走路径 + 工具路线。
 */
export type ImageEmbedResolver = (
  references: readonly ReferenceMeta[],
  model: string,
) => Promise<ImageEmbedParts>

/**
 * System prompt 构建器：由组合根注入，返回 static / dynamic 两部分；未注入则不产生 system 消息。
 * 两部分分开返回，为未来调整 dynamic 的摆放位置（如移到历史之后）留接缝。
 * 入参同时给「本轮已下发的工具」与「全部已启用工具」，供 prompt 按可调用边界分组渲染。
 */
export type SystemPromptBuilder = (input: {
  callable: readonly Tool[]
  catalog: readonly Tool[]
}) => {
  static: string
  dynamic: string
}

export interface AgentLoopService {
  run(input: AgentInput, model: string): Promise<string>
}

export const AGENT_LOOP_SERVICE_NAME = 'agentLoop'

// 暂不截断下发工具数量；保留接缝，未来需要时再调小。
const MAX_SEND_TOOLS = Number.MAX_SAFE_INTEGER

export const agentLoopPlugin: PluginObject = {
  name: 'agent-loop',
  inject: [LLM_SERVICE_NAME, TOOLS_SERVICE_NAME, SESSION_MANAGER_SERVICE_NAME],
  apply(ctx, config) {
    const llm = ctx.require<LLMService>(LLM_SERVICE_NAME)
    const tools = ctx.require<ToolRegistry>(TOOLS_SERVICE_NAME)
    const manager = ctx.require<SessionManager>(SESSION_MANAGER_SERVICE_NAME)
    const maxSteps = Number(config?.maxSteps ?? 6)
    const resolveImageEmbeds = config?.resolveImageEmbeds as ImageEmbedResolver | undefined
    const buildSystemPrompt = config?.buildSystemPrompt as SystemPromptBuilder | undefined

    ctx.provide<AgentLoopService>(AGENT_LOOP_SERVICE_NAME, {
      async run(input, model) {
        // 可选依赖在使用时解析：并发启动下 apply 时它可能尚未就绪。
        const checkpoint = ctx.get<CheckpointService>(CHECKPOINT_SERVICE_NAME)
        const session = manager.active
        const references = input.references ?? []
        session.append({
          type: 'user/message',
          text: input.text,
          ...(references.length > 0 ? { references: [...references] } : {}),
        })

        const allTools = tools.list()
        const favoriteToolNames = new Set(allTools.filter((t) => tools.isFavorite(t.name)).map((t) => t.name))

        // 引用集合在 run 内恒定（循环只追加 assistant/tool 事件），解析一次即可，避免每步重读磁盘。
        const imageEmbeds = await resolveImageEmbeds?.(collectReferences(session.events()), model) ?? new Map()

        for (let step = 0; step < maxSteps; step += 1) {
          // 安全点：请求模型之前保证历史已落盘。
          await checkpoint?.at('before-model-request')

          const events = session.events()

          // 本会话已激活的工具（事件投影，累积）；与启用注册表取交集，排除已在 favorite 的。
          const discovered = projectDiscovered(events)
          const favoriteTools = allTools.filter((t) => favoriteToolNames.has(t.name))
          const discoveredTools = allTools.filter((t) => discovered.has(t.name) && !favoriteToolNames.has(t.name))
          const sendList = [...favoriteTools, ...discoveredTools].slice(0, MAX_SEND_TOOLS)
          const sentNames = new Set(sendList.map((t) => t.name))

          // A 方案：static + dynamic 并入一条 system 消息，置于历史之前。
          const history = toChatMessages(events, imageEmbeds)
          const prompt = buildSystemPrompt?.({ callable: sendList, catalog: allTools })
          const messages: ChatMessage[] = prompt === undefined
            ? history
            : [{ role: 'system', content: `${prompt.static}\n\n${prompt.dynamic}` }, ...history]

          const result: LLMResult = await llm.chat({
            messages,
            tools: sendList.map((t) => ({
              name: t.name,
              description: t.description,
              parameters: t.parameters,
            })),
            model,
          })

          if (result.kind === 'text') {
            session.append({
              type: 'assistant/message',
              text: result.text,
              ...(result.providerState !== undefined ? { providerState: result.providerState } : {}),
            })
            await checkpoint?.at('turn-end')
            return result.text
          }

          // 推理信封先落一条空文本 assistant 事件（投影据此把信封与 tool_calls 合并回同一条消息）。
          if (result.providerState !== undefined) {
            session.append({ type: 'assistant/message', text: '', providerState: result.providerState })
          }

          // 先记录本轮所有调用（投影合并为一条 assistant.tool_calls），再逐个执行回灌结果。
          for (const call of result.calls) {
            session.append({ type: 'tool/call', callId: call.id, name: call.name, args: call.args })
          }

          for (const call of result.calls) {
            const tool = allTools.find((t) => t.name === call.name)
            if (tool === undefined) {
              session.append({
                type: 'tool/result',
                callId: call.id,
                name: call.name,
                ok: false,
                content: `unknown tool: ${call.name}`,
              })
              continue
            }

            // 激活门禁：未下发的工具不执行，回灌指引让模型走 query_capabilities 正路。
            if (!sentNames.has(call.name)) {
              session.append({
                type: 'tool/result',
                callId: call.id,
                name: call.name,
                ok: false,
                content: `工具 ${call.name} 未在本轮激活，不能直接调用。先调用 ${QUERY_CAPABILITIES_TOOL_NAME} 查询并激活，再调用。`,
              })
              continue
            }

            try {
              // 通用执行：文本进 content，结构化副产物进 data，原样记录，不认识具体工具。
              const raw = await tool.run(call.args)
              const content = typeof raw === 'string' ? raw : raw.content
              const data = typeof raw === 'string' ? undefined : raw.data
              session.append({
                type: 'tool/result',
                callId: call.id,
                name: call.name,
                ok: true,
                content,
                ...(data !== undefined ? { data } : {}),
              })
            } catch (error) {
              session.append({
                type: 'tool/result',
                callId: call.id,
                name: call.name,
                ok: false,
                content: String(error),
              })
            }
          }
        }

        throw new Error(`agent loop exceeded max steps (${maxSteps})`)
      },
    })
  },
}

// —— 辅助 ——

/** 从本会话事件投影累积已激活的工具名（union 所有 tool/result.data.discoveredTools）。 */
function projectDiscovered(events: readonly SessionEvent[]): Set<string> {
  const names = new Set<string>()
  for (const event of events) {
    if (event.type !== 'tool/result' || !event.ok) continue
    const list = event.data?.[DISCOVERED_TOOLS_DATA_KEY]
    if (!Array.isArray(list)) continue
    for (const item of list) {
      if (typeof item === 'string') names.add(item)
    }
  }
  return names
}

/** 收集历史中出现过的引用，按路径去重并保持首次出现顺序。 */
function collectReferences(events: readonly SessionEvent[]): ReferenceMeta[] {
  const seen = new Set<string>()
  const references: ReferenceMeta[] = []
  for (const event of events) {
    if (event.type !== 'user/message' || event.references === undefined) continue
    for (const reference of event.references) {
      if (seen.has(reference.path)) continue
      seen.add(reference.path)
      references.push(reference)
    }
  }
  return references
}
