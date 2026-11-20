/**
 * 编排循环。对应真实仓库 packages/core/agent-loop。
 *
 * 它不实现任何具体能力：模型来自 llm 服务，工具来自 tools 服务，
 * 历史来自 session 服务。循环本身只有「请求 → 执行 → 回灌」。
 *
 * 检查点是可选依赖：没有加载持久化策略时，循环照常工作。
 */

import type { Plugin } from '@pkg/cordis'
import {
  CHECKPOINT_SERVICE_NAME,
  SESSION_SERVICE_NAME,
  type CheckpointService,
  type SessionService,
} from '@pkg/session'
import { LLM_SERVICE_NAME, type LLMResult, type LLMService } from '@pkg/llm'
import { TOOLS_SERVICE_NAME, type ToolRegistry } from '@pkg/tools'
import { toChatMessages } from './message.ts'

export interface AgentLoopService {
  run(prompt: string, model: string): Promise<string>
}

export const AGENT_LOOP_SERVICE_NAME = 'agentLoop'

export const agentLoopPlugin: Plugin = {
  name: 'agent-loop',
  inject: [LLM_SERVICE_NAME, TOOLS_SERVICE_NAME, SESSION_SERVICE_NAME],
  apply(ctx, config) {
    const llm = ctx.require<LLMService>(LLM_SERVICE_NAME)
    const tools = ctx.require<ToolRegistry>(TOOLS_SERVICE_NAME)
    const session = ctx.require<SessionService>(SESSION_SERVICE_NAME)
    const checkpoint = ctx.get<CheckpointService>(CHECKPOINT_SERVICE_NAME)
    const maxSteps = Number(config?.maxSteps ?? 6)

    ctx.provide<AgentLoopService>(AGENT_LOOP_SERVICE_NAME, {
      async run(prompt, model) {
        session.append({ type: 'user/message', text: prompt })

        for (let step = 0; step < maxSteps; step += 1) {
          // 安全点：请求模型之前保证历史已落盘。
          // 崩溃最多丢掉这次请求之后的内容，不会丢掉整段对话。
          await checkpoint?.at('before-model-request')

          // 每次请求都从日志重算，不在内存里维护第二份对话状态。
          const result: LLMResult = await llm.chat({
            messages: toChatMessages(session.events()),
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
