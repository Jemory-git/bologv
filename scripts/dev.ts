/**
 * 开发模式编排：env-loader + esbuild watch + Vite + Electron。
 *
 * 串行：
 * 1. env-loader 加载 .env.development
 * 2. esbuild watch — 编译 main.ts + preload/index.ts 到 dist/
 * 3. Vite createServer — serve ui/，监听 5173
 * 4. 首次 build 完成 + Vite ready 后 spawn electron
 *
 * BLG_API_PORT 从 env 拿；BLG_API_URL 由 main.ts 顶层写好。
 * 主进程代码改动 → Electron 自动重启；渲染进程改动 → Vite HMR。
 */

import '../env-loader.ts'
import { spawn, type ChildProcess } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { context as esbuildContext, type Plugin } from 'esbuild'
import { createServer as createDevServer } from 'vite'

const project = dirname(dirname(fileURLToPath(import.meta.url)))
const outDir = join(project, 'dist')

// 与 build-electron.ts 保持一致：koa 生态链里有 CJS 动态 require，
// bundle 进 ESM 后 Electron 不支持，全部 external。
const NODE_MODULES = [
  'electron',
  'koa',
  '@koa/router',
  'koa-bodyparser',
  'koa-static',
]

// Windows 的 node_modules/.bin/electron 是 .cmd，spawn 不走 shell 时无法直接执行
const ELECTRON_BIN = process.platform === 'win32'
  ? join(project, 'node_modules', 'electron', 'dist', 'electron.exe')
  : join(project, 'node_modules', '.bin', 'electron')

let electronProc: ChildProcess | undefined
let uiReady = false

const port = Number(process.env.BLG_API_PORT)
if (!port || Number.isNaN(port)) {
  console.error('BLG_API_PORT is not set in .env.development')
  process.exit(1)
}

function startElectron(): void {
  if (electronProc !== undefined) return
  electronProc = spawn(ELECTRON_BIN, ['.'], {
    stdio: 'inherit',
    env: { ...process.env },
  })
  electronProc.on('exit', (code) => {
    electronProc = undefined
    if (code !== null && code !== 0) {
      console.log(`[electron] exited with code ${code}`)
    }
  })
}

function restartElectron(): void {
  if (!uiReady) return
  if (electronProc === undefined) {
    startElectron()
    return
  }
  const old = electronProc
  electronProc = undefined
  old.removeAllListeners('exit')
  old.kill()
  old.once('exit', () => startElectron())
}

/** 主进程 rebuild 成功后重启 Electron。 */
function restartOnRebuild(): Plugin {
  return {
    name: 'restart-electron',
    setup(build) {
      build.onEnd((result) => {
        if (result.errors.length > 0) {
          console.error('[esbuild] main build failed:')
          for (const error of result.errors) console.error(error.text)
          return
        }
        restartElectron()
      })
    },
  }
}

/** preload 改了只报告错误，不重启（preload 改了需要重新打开窗口）。 */
function reportPreloadErrors(): Plugin {
  return {
    name: 'report-preload-errors',
    setup(build) {
      build.onEnd((result) => {
        for (const error of result.errors) {
          console.error(`[esbuild] preload build failed: ${error.text}`)
        }
      })
    },
  }
}

// ---------- 1. esbuild watch ----------
const mainCtx = await esbuildContext({
  entryPoints: [join(project, 'main.ts')],
  outfile: join(outDir, 'main.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  external: NODE_MODULES,
  tsconfig: join(project, 'tsconfig.json'),
  logLevel: 'warning',
  plugins: [restartOnRebuild()],
})

const preloadCtx = await esbuildContext({
  entryPoints: [join(project, 'electron', 'preload', 'index.ts')],
  outfile: join(outDir, 'preload.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  external: NODE_MODULES,
  tsconfig: join(project, 'tsconfig.json'),
  logLevel: 'warning',
  plugins: [reportPreloadErrors()],
})

await Promise.all([mainCtx.watch(), preloadCtx.watch()])

// ---------- 2. Vite dev server ----------
const vite = await createDevServer({ configFile: join(project, 'vite.config.ts') })
await vite.listen()
// strictPort:false 时实际端口可能偏离 config.server.port，以真实监听地址为准。
const address = vite.httpServer?.address()
if (typeof address !== 'object' || address === null) {
  console.error('[vite] cannot resolve dev server listening address')
  process.exit(1)
}
process.env.BLG_WEB_URL = `http://localhost:${address.port}`
console.log(`[vite] ui dev server -> ${process.env.BLG_WEB_URL}`)

// ---------- 3. 启动 Electron ----------
uiReady = true
startElectron()

// ---------- 清理 ----------
async function shutdown(): Promise<void> {
  uiReady = false
  if (electronProc !== undefined) {
    electronProc.removeAllListeners('exit')
    electronProc.kill()
  }
  await mainCtx.dispose()
  await preloadCtx.dispose()
  await vite.close()
}

process.on('SIGINT', () => { void shutdown().then(() => process.exit(0)) })
process.on('SIGTERM', () => { void shutdown().then(() => process.exit(0)) })
process.on('exit', () => {
  if (electronProc !== undefined && !electronProc.killed) {
    try { electronProc.kill('SIGKILL') } catch { /* noop */ }
  }
})
