/**
 * 跨进程共享的 IPC 载荷契约。
 *
 * 主进程（electron/types/ipc.ts）、preload、渲染进程（ui/types/ipc.ts）
 * 统一从这里取类型，不再各写一份结构后手工同步。
 * 通道名仍由 electron/types/ipc.ts 维护 —— 只有主进程与 preload 需要。
 */

/** boot 通道返回：插件列表、会话根目录、工作目录。 */
export interface BootInfo {
  plugins: string[]
  sessionsRoot: string
  workingDir: string
}

/** 窗口控制动作。 */
export type WindowControlAction = 'minimize' | 'toggle-maximize' | 'close'
