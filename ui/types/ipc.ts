/**
 * 渲染进程侧的 IPC 契约：preload 通过 contextBridge 把 window.bologv 暴露给页面。
 *
 * 通道名和载荷类型必须与 electron/types/ipc.ts 保持一致——
 * BootInfo 是主进程 BootResponse 的渲染侧投影（只保留渲染进程需要的字段）。
 * 业务数据（含会话历史）走 HTTP，不走 IPC。
 */
import type { SessionEvent } from '@pkg/session'

/** boot 通道的返回：插件列表、会话根目录、工作目录。 */
export interface BootInfo {
  plugins: string[]
  sessionsRoot: string
  workingDir: string
}

export type WindowControlAction = 'minimize' | 'toggle-maximize' | 'close'

/** preload 暴露的 API；没有 Electron 外壳时 window.bologv 不存在。 */
export interface BologvApi {
  boot(): Promise<BootInfo>
  windowControl(action: WindowControlAction): Promise<void>
  isWindowMaximized(): Promise<boolean>
  onWindowMaximizedChanged(callback: (isMaximized: boolean) => void): () => void
  onEvent(callback: (event: SessionEvent) => void): () => void
  /** 开发模式下插件源码变化时触发；返回退订函数。 */
  onPluginsChanged(callback: () => void): () => void
}
