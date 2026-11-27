/**
 * 开发模式：监听插件源目录，变化时通知调用方。
 *
 * 监听的是与 catalog.ts 同一个外置插件源目录（开发态即 resources/plugins），
 * 因此归在 plugins 域而非 Electron 侧：这里只用 node:fs，不碰任何 Electron API；
 * 「变化后广播给渲染进程」属于组合根（electron/run.ts）的适配职责。
 */

import { watch } from 'node:fs'
import { APP_PATHS } from '../paths.ts'

/** 编辑器保存会连发多次事件（临时文件 + rename），合并成一次。 */
const DEBOUNCE_MS = 250

/** 监听插件源目录；返回停止监听的函数。目录不存在或不支持递归时静默降级为空操作。 */
export function watchPluginSources(onChange: () => void): () => void {
  const dir = APP_PATHS.bundledPluginsDir
  let timer: NodeJS.Timeout | undefined
  let watcher: ReturnType<typeof watch>
  try {
    watcher = watch(dir, { recursive: true }, () => {
      if (timer !== undefined) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = undefined
        onChange()
      }, DEBOUNCE_MS)
    })
  } catch {
    // 目录不存在或平台不支持 recursive：静默跳过，不影响正常启动
    return () => {}
  }

  return () => {
    if (timer !== undefined) clearTimeout(timer)
    watcher.close()
  }
}
