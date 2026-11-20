/**
 * 静态文件 + SPA history fallback。
 *
 * 生产模式：Electron 内嵌 Koa serve dist/ui/。
 * 路由规则：
 *   - /api/*  走 Koa router（static 中间件在 router 之后挂）
 *   - 其他路径 koa-static 优先找文件
 *   - 文件找不到且路径不以 /api 开头 → 回 index.html（SPA history fallback）
 */

import type { Next } from 'koa'
import serve from 'koa-static'

export function staticMiddleware({ uiRoot }: { uiRoot: string }) {
  const koaStatic = serve(uiRoot, { index: 'index.html' })

  return async (ctx: KoaContext, next: Next) => {
    await koaStatic(ctx, async () => {
      await next()
      // SPA history fallback：koa-static 没找到文件（ctx.status 还在 404）
      // 且不是 /api 开头的请求 → 回 index.html
      if (ctx.status === 404 && !ctx.path.startsWith('/api')) {
        ctx.path = '/index.html'
        ctx.status = 200
        await koaStatic(ctx, async () => {})
      }
    })
  }
}
