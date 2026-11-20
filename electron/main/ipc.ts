/**
 * IPC 通道注册。
 *
 * 架构分工：
 *   IPC → Electron/Node API 调用（boot 信息）
 *   HTTP (Koa server) → 业务数据（chat、settings 等）
 *   事件推送 → run.ts 把 Cordis root 事件直接 broadcast，不经过 IPC 通道
 */

import { ipcMain } from 'electron'
import { IPC } from '../types/ipc.ts'
import { ensureBooted } from '../../boot.ts'
import type { BootResponse } from '../types/ipc.ts'

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
}
