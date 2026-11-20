/**
 * electron-bridge 插件：把 preload 暴露的 window.bologui 包装成 Cordis 服务。
 *
 * 职责：
 *   1. 一次性拉取 BootInfo，并暴露响应式的 bootInfo 字段
 *      （SessionPathItem / WorkingDirItem 直接从这里读）
 *   2. 订阅主进程推送的 session 事件
 *
 * HTTP 业务调用（chat / models）由 UI 直接 import @ui/http/fetch.ts 发起。
 */

import { shallowRef, type ShallowRef } from 'vue'
import type { Plugin } from '@pkg/cordis'
import type { BootInfo } from '@ui/types/ipc.ts'
import type { SessionEvent } from '@pkg/session'

export const BRIDGE_SERVICE = 'electronBridge'

/** Electron 外壳提供给渲染进程的能力。 */
export interface BridgeService {
  /** 拉取启动信息；重复调用返回同一个 promise。 */
  boot(): Promise<BootInfo>
  /** 订阅会话事件；返回退订函数。 */
  onEvent(listener: (event: SessionEvent) => void): () => void
  /** 已拉取的启动信息；boot() 完成前为 null。 */
  readonly bootInfo: ShallowRef<BootInfo | null>
}

export const electronBridge: Plugin = {
  name: 'electronBridge',
  apply(ctx) {
    const api = window.bologui
    if (api === undefined) {
      throw new Error('window.bologui 不可用：请通过 Electron 外壳启动 Web UI')
    }

    const bootInfo = shallowRef<BootInfo | null>(null)
    let booted: Promise<BootInfo> | undefined

    const service: BridgeService = {
      boot: () => {
        if (bootInfo.value !== null) return Promise.resolve(bootInfo.value)
        return (booted ??= api.boot().then((info) => {
          bootInfo.value = info
          return info
        }))
      },
      onEvent: (listener) => api.onEvent(listener),
      bootInfo,
    }
    ctx.provide(BRIDGE_SERVICE, service)
  },
}
