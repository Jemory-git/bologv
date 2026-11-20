/**
 * HTTP 基础封装：统一错误处理 + 可选超时。
 * 不是 plugin——这是纯工具函数，不需要 Cordis 注入。
 */

export interface FetchOptions {
  /** HTTP method，默认 POST。 */
  method?: string
  /** 已序列化的 JSON 请求体。 */
  body?: string
  /** 额外 headers；会与内部默认 headers 合并。 */
  headers?: Record<string, string>
  /** 超时毫秒数；超时抛 TimeoutError。不设则永不超时。 */
  timeoutMs?: number
}

export class HttpError extends Error {
  readonly status: number
  readonly body: string
  constructor(status: number, body: string, message?: string) {
    super(message ?? `HTTP ${status}`)
    this.status = status
    this.body = body
    this.name = 'HttpError'
  }
}

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`request timed out after ${ms}ms`)
    this.name = 'TimeoutError'
  }
}

export async function fetchWithError(url: string, options: FetchOptions = {}): Promise<Response> {
  const controller = options.timeoutMs !== undefined ? new AbortController() : undefined

  let timer: NodeJS.Timeout | undefined
  if (controller !== undefined && options.timeoutMs !== undefined) {
    timer = setTimeout(() => controller.abort(), options.timeoutMs)
  }

  try {
    const resp = await fetch(url, {
      method: options.method ?? 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: options.body,
      signal: controller?.signal,
    })

    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      throw new HttpError(resp.status, text, `HTTP ${resp.status}: ${text || resp.statusText}`)
    }

    return resp
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError' && timer !== undefined) {
      throw new TimeoutError(options.timeoutMs!)
    }
    throw error
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

/** 便捷方法：fetchWithError → parse JSON。 */
export async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const resp = await fetchWithError(url, options)
  return (await resp.json()) as T
}
