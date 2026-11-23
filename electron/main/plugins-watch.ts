/**
 * 开发模式：监听插件源码目录，变化后通知 UI 重载。
 *
 * 开发模式下外置插件直接从 resources/plugins 读取（见 service/plugins/catalog.ts），
 * 因此这里不需要复制文件，只需把「文件已变化」这一信号推给渲染进程即可。
 */

import { watch } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

/** 编辑器保存会连发多次事件（临时文件 + rename），合并成一次。 */
const DEBOUNCE_MS = 250

export function watchPluginSources(onChange: () => void): () => void {
  const dir = join(app.getAppPath(), 'resources', 'plugins')
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
