/**
 * Koa HTTP server：承载业务数据 + 静态文件（生产模式）。
 *
 * 组装：apiResFnMount2Ctx → middleware → router → listen。
 * 路由细节见 routes/index.ts。
 */

import Koa from 'koa'
import Router from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { apiResFnMount2Ctx } from '../shared/api-response.ts'
import { ensureBooted } from '../boot.ts'
import { errorMiddleware } from './middleware/error.ts'
import { staticMiddleware } from './middleware/static.ts'
import { registerApiRoutes } from './routes/index.ts'
import type { Server } from 'node:http'
import type { StartServiceOptions } from './types.ts'

export function startService(options: StartServiceOptions): Promise<Server> {
  const bootedPromise = ensureBooted()

  const app = new Koa()

  // 挂载 apiSuccess / apiError / responseStream 到 ctx 原型
  apiResFnMount2Ctx(app)

  const router = new Router({ prefix: '/api' })

  app.use(errorMiddleware())
  app.use(bodyParser({ enableTypes: ['json'] }))

  registerApiRoutes(router, bootedPromise)
  app.use(router.routes())
  app.use(router.allowedMethods())

  // 开发模式下 uiRoot 未定义 → 跳过静态中间件（Vite 单独跑）
  if (options.uiRoot) {
    app.use(staticMiddleware({ uiRoot: options.uiRoot }))
  }

  return new Promise<Server>((resolve, reject) => {
    const server = app.listen(options.port, '127.0.0.1', () => resolve(server))
    // listen 失败（如 EADDRINUSE）走异步 error 事件；必须在拿到 server 后同步挂 reject，否则 promise 永久挂起
    server.on('error', reject)
  })
}
