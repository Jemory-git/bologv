/**
 * 预加载脚本：只暴露 IPC 通道给渲染进程。
 *
 * 业务数据（chat / models / sessions）全部走前端 http 客户端直接请求 Koa，
 * 不在 preload 做一层 HTTP 代理。
 *
 * BLG_API_URL 由根 main.ts 在顶层写好，Electron spawn electron 时继承。
 */

import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../types/ipc.ts'

contextBridge.exposeInMainWorld('bologui', {
  // boot 信息：插件列表、会话路径、工作目录
  boot: () => ipcRenderer.invoke(IPC.boot),

  onReady: (callback: (name: string) => void) => {
    const listener = (_event: unknown, payload: string) => callback(payload)
    ipcRenderer.on(IPC.ready, listener)
    return () => ipcRenderer.removeListener(IPC.ready, listener)
  },
  onEvent: (callback: (event: unknown) => void) => {
    const listener = (_event: unknown, payload: unknown) => callback(payload)
    ipcRenderer.on(IPC.event, listener)
    return () => ipcRenderer.removeListener(IPC.event, listener)
  },
})
