/**
 * 参考文件预览窗口。
 *
 * 预览是独立 surface，不复用主应用入口：
 *   - 加载 ui/preview.html，不启动 Cordis 插件树，主窗口启动路径零改动；
 *   - 不需要 preload：内容由同源 HTTP 提供，窗口里没有任何 Node 能力；
 *   - 作为发起窗口的 child，主窗口关闭时预览一并关闭。
 *
 * 同一路径只保留一个窗口：再次点击卡片时聚焦已有窗口，避免开出一串重复预览。
 */

import { BrowserWindow } from 'electron'
import type { ReferenceMeta } from '@pkg/session/references.ts'

/** 路径 → 预览窗口；窗口关闭时移除。 */
const previews = new Map<string, BrowserWindow>()

export interface OpenPreviewOptions {
  /** 发起预览的窗口；作为 parent 绑定生命周期。 */
  parent: BrowserWindow | null
  /** UI 地址（开发为 Vite，生产为内嵌 server），用于拼 preview.html。 */
  uiUrl: string
}

export function openReferencePreview(reference: ReferenceMeta, options: OpenPreviewOptions): void {
  const existing = previews.get(reference.path)
  if (existing !== undefined && !existing.isDestroyed()) {
    existing.focus()
    return
  }

  const win = new BrowserWindow({
    width: 1000,
    height: 760,
    minWidth: 480,
    minHeight: 360,
    title: reference.name,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0f1115',
    parent: options.parent ?? undefined,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  // 窗口标题固定为文件名：页面里的 <title> 不覆盖它。
  win.on('page-title-updated', (event) => event.preventDefault())
  win.once('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  previews.set(reference.path, win)
  win.on('closed', () => {
    if (previews.get(reference.path) === win) previews.delete(reference.path)
  })

  const url = new URL('preview.html', options.uiUrl)
  url.searchParams.set('path', reference.path)
  void win.loadURL(url.toString())
}
