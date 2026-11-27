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

import type { ReferenceMeta } from '@pkg/session/references.ts'
import type { WindowControlAction } from '../types/ipc.ts'

contextBridge.exposeInMainWorld('bologv', {
  // boot 信息：插件列表、会话路径、工作目录
  boot: () => ipcRenderer.invoke(IPC.boot),

  // 当前窗口控制与状态同步
  windowControl: (action: WindowControlAction) => ipcRenderer.invoke(IPC.windowControl, action),
  isWindowMaximized: () => ipcRenderer.invoke(IPC.windowIsMaximized),
  // 参考文件：只返回本地绝对路径
  pickReferenceFiles: () => ipcRenderer.invoke(IPC.pickReferences),
  // 目录选择：返回绝对路径，取消时为 null
  pickDirectory: (title?: string) => ipcRenderer.invoke(IPC.pickDirectory, title),
  // 参考文件预览：主进程建窗，内容由预览窗口走同源 HTTP 拉取
  previewReference: (reference: ReferenceMeta) => ipcRenderer.invoke(IPC.previewReference, reference),
  onWindowMaximizedChanged: (callback: (isMaximized: boolean) => void) => {
    const listener = (_event: unknown, isMaximized: boolean) => callback(isMaximized)
    ipcRenderer.on(IPC.windowMaximizedChanged, listener)
    return () => ipcRenderer.removeListener(IPC.windowMaximizedChanged, listener)
  },

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
  onPluginsChanged: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on(IPC.pluginsChanged, listener)
    return () => ipcRenderer.removeListener(IPC.pluginsChanged, listener)
  },
})
