/**
 * LLM provider：根据注入的 getVendors 动态调用模型。
 *
 * 配置按请求时点读取，不是 boot 快照：ModelModal 的修改即时生效。
 * 不再硬编码 baseURL / apiKey——全部来自 settings/models.json。
 * apiKey 通过环境变量名（apiKeyEnv）解析，不存明文。
 */

import type { Plugin } from '@pkg/cordis'
import { ApiKeyMissingError, LLM_SERVICE_NAME, ModelNotFoundError } from '@pkg/llm'
import { fetchModel, type ModelConfig } from '@pkg/http'
import type { ChatRequest, LLMService, Vendor } from '../types.ts'
import { toDeepSeekMessages, toDeepSeekTools } from './messages.ts'
import { parseResponse } from './response.ts'
import type { DeepSeekResponse } from './types.ts'

interface PluginConfig {
  /** 厂商配置读取器，由组合根注入；每次 chat 读取最新配置。 */
  getVendors: () => Promise<Vendor[]>
}

function findModel(vendors: Vendor[], modelId: string): { vendor: Vendor; modelId: string; path: string } | null {
  for (const v of vendors) {
    const m = v.models.find((m) => m.modelId === modelId)
    if (m !== undefined) return { vendor: v, modelId: m.modelId, path: m.path }
  }
  return null
}

function resolveApiKey(vendor: Vendor): string | undefined {
  const envName = vendor.apiKeyEnv?.trim()
  if (!envName) return undefined
  return process.env[envName]
}

export const deepseekLLM: Plugin = {
  name: 'deepseek-llm',
  apply(ctx, config) {
    const { getVendors } = (config ?? {}) as unknown as PluginConfig
    if (typeof getVendors !== 'function') {
      throw new Error('deepseek-llm: config.getVendors is required')
    }

    const service: LLMService = {
      async chat(request: ChatRequest) {
        const vendors = await getVendors()
        const target = findModel(vendors, request.model)
        if (target === null) {
          throw new ModelNotFoundError(
            vendors.length === 0
              ? '没有可用的厂商配置，请在设置里添加'
              : `找不到模型 ${request.model}，请在设置里添加`,
          )
        }

        const apiKey = resolveApiKey(target.vendor)
        if (!apiKey) {
          throw new ApiKeyMissingError(
            `环境变量 ${target.vendor.apiKeyEnv} 未设置。请在系统环境变量中配置该密钥后重启应用。`,
          )
        }

        const modelConfig: ModelConfig = {
          baseURL: target.vendor.baseURL,
          apiKey,
          model: target.modelId,
          path: target.path,
        }

        const body = {
          messages: toDeepSeekMessages(request.messages),
          tools: request.tools.length > 0 ? toDeepSeekTools(request.tools) : undefined,
          stream: false,
        }

        const data = await fetchModel<DeepSeekResponse>(modelConfig, { body })
        return parseResponse(data)
      },
    }

    ctx.provide<LLMService>(LLM_SERVICE_NAME, service)
  },
}
