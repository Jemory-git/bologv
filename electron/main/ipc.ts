/**
 * IPC 通道注册。
 *
 * 架构分工：
 *   IPC → Electron/Node API 调用（boot 信息）
 *   HTTP (Koa server) → 业务数据（chat、settings 等）
 *   事件推送 → run.ts 把 Cordis root 事件直接 broadcast，不经过 IPC 通道
 */

import { BrowserWindow, dialog, ipcMain } from 'electron'
import { IPC } from '../types/ipc.ts'
import { ensureBooted } from '../../boot.ts'
import { openReferencePreview } from './preview.ts'

import type { OpenDialogOptions } from 'electron'
import type { ReferenceMeta } from '@pkg/session/references.ts'
import type { BootInfo, WindowControlAction } from '../types/ipc.ts'

/** 当前版本能处理的参考文件扩展名；音频/视频待接入处理链路后再放开。 */
const REFERENCE_EXTENSIONS = [
  'txt', 'md', 'markdown', 'json', 'csv', 'tsv',
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'vue',
  'css', 'scss', 'less', 'html', 'htm', 'xml',
  'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf',
  'log', 'sql', 'py', 'go', 'rs', 'java',
  'c', 'h', 'cpp', 'hpp', 'sh', 'ps1',
  'png', 'jpg', 'jpeg', 'webp', 'gif',
]

export interface IpcOptions {
  /** UI 地址：只用于拼预览窗口的 preview.html。 */
  uiUrl: string
}

export function registerIpc(options: IpcOptions): void {
  // boot：Electron 相关信息（workingDir、plugins 列表等）
  ipcMain.handle(IPC.boot, async (): Promise<BootInfo> => {
    const booted = await ensureBooted()
    return {
      plugins: booted.plugins,
      sessionsRoot: booted.sessionsRoot,
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

  // 参考文件：只返回绝对路径，不读取也不复制内容。
  ipcMain.handle(IPC.pickReferences, async (event): Promise<string[]> => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options: OpenDialogOptions = {
      title: '选择参考文件',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: '支持的参考文件', extensions: REFERENCE_EXTENSIONS }],
    }
    const result = win === null
      ? await dialog.showOpenDialog(options)
      : await dialog.showOpenDialog(win, options)
    return result.canceled ? [] : result.filePaths
  })

  // 目录选择：工作目录配置等场景只需要一个绝对路径，取消时返回 null。
  ipcMain.handle(IPC.pickDirectory, async (event, title?: string): Promise<string | null> => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options: OpenDialogOptions = {
      title: typeof title === 'string' && title !== '' ? title : '选择目录',
      properties: ['openDirectory'],
    }
    const result = win === null
      ? await dialog.showOpenDialog(options)
      : await dialog.showOpenDialog(win, options)
    return result.canceled ? null : result.filePaths[0] ?? null
  })

  // 参考文件预览：内容由同源 HTTP 提供，主进程只负责窗口与去重。
  ipcMain.handle(IPC.previewReference, (event, reference: ReferenceMeta): void => {
    const parent = BrowserWindow.fromWebContents(event.sender)
    openReferencePreview(reference, { parent, uiUrl: options.uiUrl })
  })
}
