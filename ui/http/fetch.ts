/**
 * 前端 HTTP 客户端。
 *
 * 纯 transport 层：发请求 + 解析 JSON 返回。
 * 不解释 service 层的业务契约（code / msg / errCode），
 * 那些由调用方自己根据需要判断。
 *
 * 返回 tuple [Error | null, Body<T>, Response | null]：
 *   - err !== null → transport 层失败（网络中断 / HTTP 非 200 / 响应体非法 JSON）
 *   - err === null → 有完整 JSON 响应，调用方自己判 body.code
 *   - 第三项仅在拿到真实响应时存在，网络层失败时为 null
 *
 * 一切异常在本层吸收为 tuple，调用方保持无 try/catch 的扁平控制流。
 *
 * base URL 用 window.location.origin：
 *   - 开发环境 → Vite dev server，由 vite proxy 转发 /api → Koa
 *   - 生产环境 → Electron 内嵌的 Koa（serve 静态 + /api）
 */

type Body<T> = ResponseBody<T>

type AppFetchReturn<T> = Promise<[Error | null, Body<T>, Response | null]>

type AppFetchOptions = {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  params?: Record<string, any>
  body?: any
  headers?: Record<string, string>
  stream?: boolean
}

export async function appFetch<T>(options: AppFetchOptions): AppFetchReturn<T> {
  try {
    const url = new URL(options.url, window.location.origin)

    if (options.params) {
      Object.entries(options.params).forEach(([k, v]) => {
        if (v != undefined && v !== '') {
          url.searchParams.set(k, v) // URLSearchParams.set() 自动 encode
        }
      })
    }

    const isFormData = options.body instanceof FormData

    const res = await fetch(url.toString(), {
      method: options.method || 'GET',
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(options.headers || {}),
      },
      body: options.body && options.method !== 'GET'
        ? isFormData ? options.body : JSON.stringify(options.body)
        : undefined,
    })

    // 流式响应：不走 JSON 解析，直接把 Response 交给调用方处理
    if (options.stream) {
      return [null, { code: 0, msg: '' }, res]
    }

    // HTTP 层错误
    if (!res.ok) {
      return [new Error(`HTTP ${res.status}`), { code: -1, msg: '' }, res]
    }

    return [null, (await res.json()) as Body<T>, res]
  } catch (error) {
    // 网络中断、响应体截断 / 非法 JSON 等：归一为 tuple，不让异常穿透到调用方
    const err = error instanceof Error ? error : new Error(String(error))
    return [err, { code: -1, msg: '' }, null]
  }
}

export const http = {
  get<T>(url: string, params?: Record<string, any>): AppFetchReturn<T> {
    return appFetch({ url, method: 'GET', params })
  },
  post<T>(url: string, body?: any): AppFetchReturn<T> {
    return appFetch({ url, method: 'POST', body })
  },
  put<T>(url: string, body?: any): AppFetchReturn<T> {
    return appFetch({ url, method: 'PUT', body })
  },
  delete<T>(url: string, params?: Record<string, any>): AppFetchReturn<T> {
    return appFetch({ url, method: 'DELETE', params })
  },
  streamGet<T>(url: string, params?: Record<string, any>): AppFetchReturn<T> {
    return appFetch({ url, method: 'GET', params, stream: true })
  },
  streamPost<T>(url: string, body?: any): AppFetchReturn<T> {
    return appFetch({ url, method: 'POST', body, stream: true })
  },
}
