/**
 * 语言能力分发器：唯一 provide('llm')。
 *
 * 职责链：getVendors → findModel → resolveApiKey → 按 model.protocol 选适配器
 * → 信封过滤 → encode → fetchModel → decode → vendorId 盖章。
 *
 * 配置按请求时点读取，不是 boot 快照：ModelModal 的修改即时生效。
 * apiKey 通过环境变量名（apiKeyEnv）解析，不存明文。
 *
 * 信封（providerState）的两个单点都在这里：
 *   - 过滤：encode 前只保留协议/厂商标签匹配的信封，其余置 undefined；
 *   - 盖章：decode 后把 vendorId 补进适配器产出的信封（适配器只填 protocol+data）。
 */

import type { PluginObject } from '@pkg/cordis'
import { fetchModel } from '@pkg/http'
import type { ModelConfig } from '@pkg/http'
import { ApiKeyMissingError, ModelNotFoundError } from '@pkg/models'
import type { ModelDef, Vendor } from '@pkg/models/types.ts'
import { LLM_SERVICE_NAME } from './types.ts'
import type { ChatRequest, LLMService } from './types.ts'
import { adapters } from './protocols/index.ts'

interface PluginConfig {
  /** 厂商配置读取器，由组合根注入；每次 chat 读取最新配置。 */
  getVendors: () => Promise<Vendor[]>
}

function findModel(vendors: Vendor[], modelId: string): { vendor: Vendor; model: ModelDef } | null {
  for (const v of vendors) {
    const m = v.models.find((m) => m.modelId === modelId)
    if (m !== undefined) return { vendor: v, model: m }
  }
  return null
}

function resolveApiKey(vendor: Vendor): string | undefined {
  const envName = vendor.apiKeyEnv?.trim()
  if (!envName) return undefined
  return process.env[envName]
}

export const plugin: PluginObject = {
  name: 'language',
  apply(ctx, config) {
    const { getVendors } = (config ?? {}) as unknown as PluginConfig
    if (typeof getVendors !== 'function') {
      throw new Error('language: config.getVendors is required')
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

        const adapter = adapters[target.model.protocol]

        // 信封过滤单点：标签不匹配（换厂商/换协议）的信封不回传。
        // map 新对象，禁止改写只读事件引用。
        const messages = request.messages.map((m) => {
          const state = m.providerState
          if (state === undefined) return m
          if (state.protocol === target.model.protocol && state.vendorId === target.vendor.id) return m
          return { ...m, providerState: undefined }
        })

        const modelConfig: ModelConfig = {
          baseURL: target.vendor.baseURL,
          apiKey,
          path: target.model.path,
        }
        const body = adapter.encode({ ...request, messages }, target.model.modelId)
        const raw = await fetchModel(modelConfig, { body, headers: adapter.headers(apiKey) })
        const result = adapter.decode(raw)

        // vendorId 盖章单点：适配器 decode 只填 protocol+data（vendorId 空串占位）。
        if (result.providerState !== undefined) {
          return { ...result, providerState: { ...result.providerState, vendorId: target.vendor.id } }
        }
        return result
      },
    }

    ctx.provide<LLMService>(LLM_SERVICE_NAME, service)
  },
}
