/**
 * Electron 构建：
 * 1. esbuild 打包入口 main.ts + preload/index.ts → dist/main.mjs + dist/preload.mjs
 *    生产配置（NODE_ENV 等）经 define 烘焙进 main.mjs，运行时不依赖 .env 文件
 * 2. Vite 构建 ui → dist/ui（Koa serve 这个目录）
 *
 * 生产模式下所有东西都在根 dist/ 里：main.mjs（入口）+ preload.mjs + ui/（静态）
 */

import '../env-loader.ts'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { build as buildWebUi } from 'vite'

const project = dirname(dirname(fileURLToPath(import.meta.url)))
const out = join(project, 'dist')

// 生产配置在构建期烘焙进 bundle（main.ts 运行时不再加载 .env）。
// 端口不烘焙：生产用 port 0 由 OS 运行时分配，避免与用户进程冲突。
const PRODUCTION_DEFINE = {
  'process.env.NODE_ENV': JSON.stringify('production'),
  // 生产窗口永远走内嵌 Koa，屏蔽外部残留的 dev URL
  'process.env.BLG_WEB_URL': 'undefined',
}

// koa 生态链里有 CJS 模块用 Node builtins 的动态 require，
// esbuild bundle 进 ESM 后会变成 __require2('node:util')，Electron 里不支持。
// 全部 external，让 Node 自己 resolve 即可。
const NODE_MODULES = [
  'electron',
  'koa',
  '@koa/router',
  'koa-bodyparser',
  'koa-static',
]

await rm(out, { recursive: true, force: true })
await mkdir(out, { recursive: true })

// 1. 主入口 main.ts（含 boot.ts / settings.ts / service/*）
await build({
  entryPoints: [join(project, 'main.ts')],
  outfile: join(out, 'main.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  external: NODE_MODULES,
  define: PRODUCTION_DEFINE,
  tsconfig: join(project, 'tsconfig.json'),
  logLevel: 'info',
})

// 2. Preload：独立 bundle（Electron 要求 preload 是独立文件）
await build({
  entryPoints: [join(project, 'electron', 'preload', 'index.ts')],
  outfile: join(out, 'preload.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  external: NODE_MODULES,
  tsconfig: join(project, 'tsconfig.json'),
  logLevel: 'info',
})

// 3. UI：Vite 构建到 dist/ui
await buildWebUi({ configFile: join(project, 'vite.config.ts') })

console.log(`electron build ok -> ${out}`)
