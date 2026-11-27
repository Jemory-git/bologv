/**
 * Electron 生命周期封装：app.whenReady() 里的一切。
 *
 * 包括：
 *   - registerIpc()  — 只注册纯 Electron 信息的 handler
 *   - 创建 BrowserWindow
 *   - Cordis 事件 → Electron broadcast 转发
 *   - app 生命周期监听（activate / window-all-closed）
 *
 * 这是唯一调用 app.whenReady() 的地方。
 */

import { app, BrowserWindow, dialog } from 'electron'
import { createWindow, broadcast } from './main/window.ts'
import { registerIpc } from './main/ipc.ts'
import { watchPluginSources } from '../service/external-plugins/watch.ts'
import { teardown, type Booted } from '../boot.ts'
import { IPC } from './types/ipc.ts'
import type { Server } from 'node:http'

export interface RunOptions {
  server: Server
  booted: Booted
  preloadPath: string
  getUiUrl(): string
}

export function run(options: RunOptions): void {
  void app.whenReady().then(async () => {
    const uiUrl = options.getUiUrl()
    registerIpc({ uiUrl })

    // Cordis 事件 → Electron window broadcast
    options.booted.root.on('plugin/ready', (name) => broadcast(IPC.ready, String(name)))
    options.booted.root.on('session/event', (event) => broadcast(IPC.event, event))

    // 开发模式：插件源码变动 → 通知渲染进程自动重扫并重载
    const stopWatching = process.env.NODE_ENV === 'production'
      ? undefined
      : watchPluginSources(() => broadcast(IPC.pluginsChanged, Date.now()))

    createWindow({ uiUrl, preloadPath: options.preloadPath })

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow({ uiUrl, preloadPath: options.preloadPath })
      }
    })

    app.on('window-all-closed', () => {
      console.log('window-all-closed');
      
      stopWatching?.()
      void teardown().finally(() => {
        app.quit()
        // keep-alive 连接会拖住 close()；先断开全部连接再关闭。
        options.server.closeAllConnections()
        options.server.close()
      })
    })
  })
}

/** 启动失败兜底：关掉已起的 service，弹框告知用户，退出应用。Electron API 统一收在生命周期层。 */
export function abortStartup(error: unknown, server?: Server): void {
  const message = error instanceof Error ? error.message : String(error)
  console.error('[startup] failed:', error)
  server?.closeAllConnections()
  server?.close()
  void app.whenReady().then(() => {
    dialog.showErrorBox('启动失败', message)
    app.quit()
  })
}
