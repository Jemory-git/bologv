/**
 * 极简 .env 加载器。
 *
 * 替代 dotenv-flow：
 *   - dotenv-flow 是 CJS，esbuild bundle 进 ESM main.mjs 后动态 require('fs') 不被支持
 *   - 我们只需要读几个变量，不值得引一个有 bundle 兼容性问题的库
 *
 * 优先级：.env.{NODE_ENV} 覆盖 .env（不覆盖已有进程内 env）
 */

import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const env = process.env.NODE_ENV ?? 'development'
const root = dirname(fileURLToPath(import.meta.url))

const files = [
  resolve(root, `.env.${env}`),
  resolve(root, '.env'),
]

for (const file of files) {
  if (!existsSync(file)) continue
  const content = readFileSync(file, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    // 去首尾引号
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}
