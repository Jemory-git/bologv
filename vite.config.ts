/**
 * Vite 配置：仅作为 ui/ 的开发服务器和生产构建工具。
 * Electron 主进程仍由 esbuild 构建（见 scripts/build-electron.ts）。
 *
 * resolve.alias 与 tsconfig.base.json 的 paths 保持同步。
 */

import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import Icons from 'unplugin-icons/vite'
import { defineConfig, loadEnv } from 'vite'

const project = fileURLToPath(new URL('.', import.meta.url))

/**
 * 与 tsconfig.base.json 的 paths 对齐。
 * packages 统一用 @pkg/xxx 前缀。
 */
const alias: Record<string, string> = {
  '@ui': fileURLToPath(new URL('./ui', import.meta.url)),
  '@pkg/cordis': fileURLToPath(new URL('./packages/cordis/index.ts', import.meta.url)),
  // types.ts 别名仅供纯类型导入（运行时被擦除）；放在包别名之前，避免前缀匹配抢先
  '@pkg/session/types.ts': fileURLToPath(new URL('./packages/session/types.ts', import.meta.url)),
  '@pkg/session': fileURLToPath(new URL('./packages/session/index.ts', import.meta.url)),
  '@pkg/llm/types.ts': fileURLToPath(new URL('./packages/llm/types.ts', import.meta.url)),
  '@pkg/llm': fileURLToPath(new URL('./packages/llm/index.ts', import.meta.url)),
  '@pkg/http': fileURLToPath(new URL('./packages/http/index.ts', import.meta.url)),
  '@pkg/llm-mock': fileURLToPath(new URL('./packages/llm/llm-mock/index.ts', import.meta.url)),
  '@pkg/llm-deepseek': fileURLToPath(new URL('./packages/llm/llm-deepseek/index.ts', import.meta.url)),
  '@pkg/runtime': fileURLToPath(new URL('./packages/runtime/index.ts', import.meta.url)),
  '@pkg/tools': fileURLToPath(new URL('./packages/tools/index.ts', import.meta.url)),
  '@pkg/agent-assistant': fileURLToPath(new URL('./packages/agents/assistant/index.ts', import.meta.url)),
}

export default defineConfig(({ mode }) => {
  // 读 BLG_API_PORT，不传前缀 → 加载 .env.{mode} 里所有变量
  // 开发代理需要固定目标端口，未配置直接失败，不用默认值
  const env = loadEnv(mode, process.cwd(), '')
  const apiPort = Number(env.BLG_API_PORT)
  if (!apiPort) {
    throw new Error('BLG_API_PORT is not set in .env.development (Vite proxy needs a fixed target)')
  }

  return {
    root: 'ui',
    plugins: [
      vue(),
      Icons({ autoInstall: true }),
    ],
    resolve: {
      alias,
      dedupe: ['vue'],
    },
    server: {
      port: 5173,
      strictPort: false,
      fs: { allow: [project] },
      proxy: {
        // 开发时 @ui/http 的 fetch 指向 location.origin → Vite → Koa
        '/api': {
          target: `http://127.0.0.1:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: '../dist/ui',
      emptyOutDir: true,
      // 主应用与预览窗口是两个独立入口：预览不加载插件树，也不经过主入口的启动逻辑。
      rollupOptions: {
        input: {
          main: fileURLToPath(new URL('./ui/index.html', import.meta.url)),
          preview: fileURLToPath(new URL('./ui/preview.html', import.meta.url)),
        },
      },
    },
  }
})
