/**
 * 针对模型端点的便捷调用：协议无关的传输层。
 * 把 ModelConfig 展开成 URL，POST 调用方给定的 body 与 headers，底层走 fetchJson。
 * 不注入 Authorization、不注入 model——认证与 body 形状由协议适配器负责。
 */

import { fetchJson, type FetchOptions } from './fetch.ts'
import type { ModelConfig } from './types.ts'

/** 模型请求默认超时：端点挂起时及时失败，避免会话单飞锁被永久占用。 */
const DEFAULT_MODEL_TIMEOUT_MS = 120_000

export interface FetchModelOptions extends Omit<FetchOptions, 'body' | 'headers' | 'method'> {
  /** 已序列化的 JSON 请求体，形状由协议适配器决定。 */
  body: Record<string, unknown>
  /** 完整请求 headers（含认证），由协议适配器提供。 */
  headers: Record<string, string>
}

/**
 * 组装 URL，POST 到模型端点，返回解析后的 JSON。
 * 默认超时 120s，可经 options.timeoutMs 覆盖。
 */
export async function fetchModel<T = unknown>(
  config: ModelConfig,
  options: FetchModelOptions,
): Promise<T> {
  const url = `${config.baseURL.replace(/\/+$/, '')}${config.path}`

  return fetchJson<T>(url, {
    method: 'POST',
    body: JSON.stringify(options.body),
    headers: options.headers,
    timeoutMs: options.timeoutMs ?? DEFAULT_MODEL_TIMEOUT_MS,
  })
}
