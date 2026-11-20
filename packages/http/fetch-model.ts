/**
 * 针对「模型 chat completion」端点的便捷调用。
 * 把 ModelConfig 展开成 URL + Authorization header + body，底层走 fetchJson。
 */

import { fetchJson, type FetchOptions } from './fetch.ts'
import type { ModelConfig } from './types.ts'

/** 模型请求默认超时：端点挂起时及时失败，避免会话单飞锁被永久占用。 */
const DEFAULT_MODEL_TIMEOUT_MS = 120_000

export interface FetchModelOptions extends Omit<FetchOptions, 'body' | 'headers' | 'method'> {
  /** 已序列化的 JSON 请求体（不含 model 字段，由 config.model 自动注入）。 */
  body: Record<string, unknown>
  /** 额外 headers；会与内部默认 headers 合并。 */
  headers?: Record<string, string>
}

/**
 * 组装 URL + Authorization，POST 到模型端点，返回解析后的 JSON。
 * body 里的 `model` 字段会被 `config.model` 覆盖（保证与 URL/config 一致）。
 * 默认超时 120s，可经 options.timeoutMs 覆盖。
 */
export async function fetchModel<T = unknown>(
  config: ModelConfig,
  options: FetchModelOptions,
): Promise<T> {
  const url = `${config.baseURL.replace(/\/+$/, '')}${config.path}`

  const bodyWithModel = { ...options.body, model: config.model }

  return fetchJson<T>(url, {
    method: 'POST',
    body: JSON.stringify(bodyWithModel),
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      ...options.headers,
    },
    timeoutMs: options.timeoutMs ?? DEFAULT_MODEL_TIMEOUT_MS,
  })
}
