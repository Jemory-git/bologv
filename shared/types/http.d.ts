/**
 * HTTP 响应契约的全局类型 + Koa ctx 扩展。
 *
 * ResponseBody / ApiSuccessOptions / ApiErrorOptions 是全局类型，
 * service 的 api-response 与 ui 的 fetch 共同消费。
 *
 * KoaContext 是项目显式的 ctx 契约：Context + api-response 挂载的响应助手。
 * 不修改 koa 自身类型（不做 module augmentation），
 * 中间件 / 路由 handler 一律显式标注 ctx: KoaContext 获得类型保护。
 * 注意：未标注的 ctx 会落回 DefaultContext 的 any 索引签名，标注不可省略。
 */

import type { Context } from 'koa'

declare global {
  interface ResponseBody<T = unknown, O = unknown> {
    code: number
    errCode?: number
    errMsg?: string
    other?: O
    msg: string
    data?: T
  }

  type ApiErrorOptions = Omit<ResponseBody, 'code'>
  type ApiSuccessOptions = Omit<ResponseBody, 'code' | 'errCode' | 'errMsg'>

  interface KoaContext extends Context {
    /** 路由参数（@koa/router 注入） */
    params: Record<string, string>
    apiError(options: ApiErrorOptions): void
    apiSuccess(options: ApiSuccessOptions): void
    responseStream(stream: AsyncIterable<unknown>): void
  }
}

export {}
