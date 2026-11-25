/**
 * 编排循环：请求 → 工具 → 回灌。
 *
 * 不实现具体能力：模型来自 llm 服务，工具来自 tools 服务，
 * 历史来自当前活跃会话（通过 SessionManager.active）。
 *
 * 检查点是可选依赖：没有加载持久化策略时，循环照常工作。
 * 参考文件解析同样是可选依赖：由组合根注入，循环只负责把 id 交给它。
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
import { LLM_SERVICE_NAME, type ChatContentPart, type LLMResult, type LLMService } from '@pkg/llm'
import { TOOLS_SERVICE_NAME, type ToolRegistry } from '@pkg/tools'
import { toChatMessages, type ReferenceParts } from './message.ts'

/** 一次用户输入：文本可以为空，但文本与引用不能同时为空。 */
export interface AgentInput {
  text: string
  references?: readonly ReferenceMeta[]
}

/**
 * 把历史里出现过的引用批量转换成模型可见片段。
 * 由组合根注入；没有注入时引用会显示为「内容不可用」。
 */
export type ReferencePartResolver = (
  references: readonly ReferenceMeta[],
  model: string,
) => Promise<ReferenceParts>

export interface AgentLoopService {
  run(input: AgentInput, model: string): Promise<string>
}

export const AGENT_LOOP_SERVICE_NAME = 'agentLoop'

export const agentLoopPlugin: PluginObject = {
  name: 'agent-loop',
  inject: [LLM_SERVICE_NAME, TOOLS_SERVICE_NAME, SESSION_MANAGER_SERVICE_NAME],
  apply(ctx, config) {
    const llm = ctx.require<LLMService>(LLM_SERVICE_NAME)
    const tools = ctx.require<ToolRegistry>(TOOLS_SERVICE_NAME)
    const manager = ctx.require<SessionManager>(SESSION_MANAGER_SERVICE_NAME)
    const maxSteps = Number(config?.maxSteps ?? 6)
    const resolveReferences = config?.resolveReferences as ReferencePartResolver | undefined

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

        for (let step = 0; step < maxSteps; step += 1) {
          // 安全点：请求模型之前保证历史已落盘。
          await checkpoint?.at('before-model-request')

          const events = session.events()
          const parts = await resolveReferences?.(collectReferences(events), model) ?? new Map()
          const result: LLMResult = await llm.chat({
            messages: toChatMessages(events, parts),
            tools: tools.list().map((tool) => ({
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
            })),
            model,
          })

          if (result.kind === 'text') {
            session.append({ type: 'assistant/message', text: result.text })
            await checkpoint?.at('turn-end')
            return result.text
          }

          for (const call of result.calls) {
            session.append({ type: 'tool/call', callId: call.id, name: call.name, args: call.args })
            const tool = tools.get(call.name)
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
            try {
              const content = await tool.run(call.args)
              session.append({ type: 'tool/result', callId: call.id, name: call.name, ok: true, content })
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
