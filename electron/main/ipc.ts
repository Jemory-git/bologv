/**
 * IPC 通道注册。
 *
 * 架构分工：
 *   IPC → Electron/Node API 调用（boot 信息）
 *   HTTP (Koa server) → 业务数据（chat、settings 等）
 *   事件推送 → run.ts 把 Cordis root 事件直接 broadcast，不经过 IPC 通道
 */

import { BrowserWindow, ipcMain } from 'electron'
import { IPC } from '../types/ipc.ts'
import { ensureBooted } from '../../boot.ts'

import type { BootResponse, WindowControlAction } from '../types/ipc.ts'

export function registerIpc(): void {
  // boot：Electron 相关信息（workingDir、plugins 列表等）
  ipcMain.handle(IPC.boot, async (): Promise<BootResponse> => {
    const booted = await ensureBooted()
    return {
      plugins: booted.plugins,
      sessionPath: booted.sessionPath,
      workingDir: booted.workingDir,
    }
  })

  // window：只操作发起调用的渲染进程所属窗口，不持有全局窗口引用。
  ipcMain.handle(IPC.windowControl, (event, action: WindowControlAction): void => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win || win.isDestroyed()) return

    switch (action) {
      case 'minimize':
        win.minimize()
        break
      case 'toggle-maximize':
        if (win.isMaximized()) win.unmaximize()
        else win.maximize()
        break
      case 'close':
        win.close()
        break
      default:
        throw new Error(`unknown window control action: ${String(action)}`)
    }
  })

  ipcMain.handle(IPC.windowIsMaximized, (event): boolean => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win?.isMaximized() ?? false
  })
}
