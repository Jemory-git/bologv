/**
 * 渲染进程侧的 IPC 契约：preload 通过 contextBridge 把 window.bologv 暴露给页面。
 *
 * 载荷类型（BootInfo / WindowControlAction）来自 shared/ipc.ts，
 * 与主进程、preload 共用同一份定义；这里只描述窗口对象本身的形状。
 * 业务数据（含会话历史）走 HTTP，不走 IPC。
 */
import type { ReferenceMeta, SessionEvent } from '@pkg/session'
import type { BootInfo, WindowControlAction } from '../../shared/ipc.ts'

export type { BootInfo, WindowControlAction } from '../../shared/ipc.ts'

/** preload 暴露的 API；没有 Electron 外壳时 window.bologv 不存在。 */
export interface BologvApi {
  boot(): Promise<BootInfo>
  windowControl(action: WindowControlAction): Promise<void>
  isWindowMaximized(): Promise<boolean>
  /** 打开系统文件选择框，返回本地绝对路径；取消时返回空数组。 */
  pickReferenceFiles(): Promise<string[]>
  /** 打开系统目录选择框，返回本地绝对路径；取消时返回 null。 */
  pickDirectory(title?: string): Promise<string | null>
  /** 打开独立预览窗口；同一路径已打开时聚焦已有窗口。 */
  previewReference(reference: ReferenceMeta): Promise<void>
  onWindowMaximizedChanged(callback: (isMaximized: boolean) => void): () => void
  onEvent(callback: (event: SessionEvent) => void): () => void
  /** 开发模式下插件源码变化时触发；返回退订函数。 */
  onPluginsChanged(callback: () => void): () => void
}
