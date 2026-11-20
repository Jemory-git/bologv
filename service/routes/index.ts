/**
 * 主 API 路由：组装子路由。
 *
 * 所有子路由独立 new Router，用 router.use('/xxx', sub.routes()) 挂载。
 * 子路由内部 handler 写 '/' 就对应完整路径 /api/xxx。
 */

import type Router from '@koa/router'
import type { Booted } from '../../boot.ts'
import { healthRouter } from './health.ts'
import { modelsRouter } from './models.ts'
import { settingsRouter } from './settings.ts'
import { createChatRouter } from './chat.ts'
import { createSessionsRouter } from './sessions.ts'

export function registerApiRoutes(router: Router, bootedPromise: Promise<Booted>): void {
  router.use('/health', healthRouter.routes())
  router.use('/chat', createChatRouter(bootedPromise).routes())
  router.use('/models', modelsRouter.routes())
  router.use('/settings', settingsRouter.routes())
  router.use('/sessions', createSessionsRouter(bootedPromise).routes())
}
