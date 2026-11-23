/**
 * BrowserWindow 创建 + 跨窗口事件广播。
 *
 * broadcast 让 IPC 和 boot 层都能把事件推送给所有打开的窗口，
 * 不需要知道具体有几个窗口、窗口引用在哪里。
 */

import { BrowserWindow } from 'electron'
import { IPC } from '../types/ipc.ts'

export function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
}

function sendMaximized(win: BrowserWindow): void {
  win.webContents.send(IPC.windowMaximizedChanged, win.isMaximized())
}

export interface CreateWindowOptions {
  /** UI 地址。开发时是 Vite URL，生产时是内嵌 server URL。 */
  uiUrl: string
  /** preload 脚本路径。 */
  preloadPath: string
}

export function createWindow(options: CreateWindowOptions): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: options.preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      // preload 只用 contextBridge / ipcRenderer，沙箱内即可运行。
      sandbox: false,
    },
  })

  mainWindow.on('maximize', () => sendMaximized(mainWindow))
  mainWindow.on('unmaximize', () => sendMaximized(mainWindow))

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    mainWindow.maximize()
    // 仅开发环境开 DevTools；生产构建经 esbuild define 烘焙 NODE_ENV=production。
    if (process.env.NODE_ENV !== 'production') mainWindow.webContents.openDevTools()
  })
  void mainWindow.loadURL(options.uiUrl)
  return mainWindow
}
