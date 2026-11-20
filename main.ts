/**
 * Electron 应用入口：纯组装。
 *
 * 不调用任何 Electron API（app.whenReady、BrowserWindow 等），
 * 只负责：
 *   1. 启动 Koa HTTP server（service）
 *   2. 启动 Cordis 插件树（boot）
 *   3. 收敛启动结果：成功调 run()，失败调 abortStartup()（Electron 生命周期统一在 electron/run.ts）
 *
 * 环境变量不在这里加载：
 *   开发 → dev.ts 加载 .env.development，spawn 时继承给 Electron 子进程
 *   生产 → build-electron.ts 通过 esbuild define 把配置烘焙进 bundle
 */

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { run, abortStartup } from './electron/run.ts'
import { startService } from './service/main.ts'
import { ensureBooted } from './boot.ts'

import type { Server } from 'node:http'

const __dirname = dirname(fileURLToPath(import.meta.url))

// —— 端口策略 ——
// 生产：port 0，由 OS 分配空闲端口，永不与用户进程冲突
// 开发：env 固定端口（Vite proxy 需要确定目标），没配直接崩
const isProduction = process.env.NODE_ENV === 'production'
const port = isProduction ? 0 : Number(process.env.BLG_API_PORT)
if (!isProduction && !port) {
  throw new Error('BLG_API_PORT is not set in environment')
}

let started: Server | undefined

// service 监听成功即写回真实端口（生产 port 0 依赖这一步），并记下 handle 供失败时关闭
const serviceReady = startService({
  port,
  uiRoot: isProduction ? join(__dirname, 'ui') : undefined,
}).then((server) => {
  started = server
  const addr = server.address()
  const actualPort = typeof addr === 'object' && addr ? addr.port : port
  process.env.BLG_API_URL = `http://127.0.0.1:${actualPort}/`
  return server
})

// 创建插件树
const bootedReady = ensureBooted()

// 同步收敛：Promise.all 立即订阅两个 promise，消除 app-ready 前的 unhandled rejection 窗口
void Promise.all([serviceReady, bootedReady])
  .then(([server, booted]) => {
    run({
      server,
      booted,
      preloadPath: join(__dirname, 'preload.mjs'),
      getUiUrl: () => process.env.BLG_WEB_URL ?? process.env.BLG_API_URL!,
    })
  })
  .catch((error) => abortStartup(error, started))
