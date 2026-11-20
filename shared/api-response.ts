/**
 * Koa ctx 响应助手：apiSuccess / apiError / responseStream。
 * envelope 契约见 shared/types/http.d.ts（ResponseBody / KoaContext）。
 */

import Koa from 'koa'
import { Readable } from 'node:stream'

/** 剔除 null / undefined 字段，保持 envelope 紧凑。 */
function compact(body: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(body).filter(([, value]) => value != null))
}

export function apiResFnMount2Ctx(koa: Koa<Koa.DefaultState, Koa.DefaultContext>) {
  koa.context.apiError = function ({ msg, data, errCode, errMsg, other }: ApiErrorOptions) {
    this.status = 200
    this.body = compact({ code: -1, errCode, errMsg, other, msg, data })
  }

  koa.context.apiSuccess = function ({ msg, data, other }: ApiSuccessOptions) {
    this.status = 200
    this.body = compact({ code: 0, errCode: null, errMsg: null, other, msg, data })
  }

  /** SSE 流式响应：消费 async iterable，逐项输出 data: 帧。 */
  koa.context.responseStream = function (stream: AsyncIterable<unknown>) {
    this.type = 'text/event-stream'
    this.status = 200
    this.set('Cache-Control', 'no-cache, no-transform')
    this.set('Connection', 'keep-alive')

    const responseStream = Readable.from(async function* () {
      for await (const chunk of stream) {
        yield `data: ${JSON.stringify(chunk)}\n\n`
      }
    }())

    // 客户端断开（close 且未写完）：销毁流，停止上游继续生成。
    this.res.once('close', () => {
      if (!this.res.writableFinished) responseStream.destroy()
    })
    this.body = responseStream
  }
}
