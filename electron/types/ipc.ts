/**
 * IPC 通道的集中定义。主进程和 preload 共享这份契约。
 *
 * 注意：业务数据（chat、settings、会话历史）走 Koa HTTP server，
 * IPC 只保留 Electron/Node API 调用 + 事件推送通道。
 * Boot 通道只返回外壳信息，不携带业务数据。
 *
 * 载荷类型（BootInfo / WindowControlAction）定义在 shared/ipc.ts，
 * 由主进程、preload、渲染进程共用。
 */

export type { BootInfo, WindowControlAction } from '../../shared/ipc.ts'

/** IPC 通道名。 */
export const IPC = {
  boot: 'blg:boot',
  ready: 'blg:ready',
  event: 'blg:event',
  pluginsChanged: 'blg:plugins-changed',
  windowControl: 'blg:window-control',
  windowIsMaximized: 'blg:window-is-maximized',
  windowMaximizedChanged: 'blg:window-maximized-changed',
  pickReferences: 'blg:pick-references',
  previewReference: 'blg:preview-reference',
} as const

// Boot 通道载荷：BootInfo（见 shared/ipc.ts）

// Ready 通道 — payload 是插件名字符串
// Event 通道 — payload 是 SessionEvent
// PluginsChanged 通道 — payload 是发生变化的时间戳，仅作重载信号
