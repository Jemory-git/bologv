/**
 * electron-bridge 插件：把 preload 暴露的 window.bologv 包装成 Cordis 服务。
 *
 * 职责：
 *   1. 装配时即拉取 BootInfo，暴露响应式 bootInfo 字段
 *      （SessionPathItem / WorkingDirItem 直接读；失败保持 null，由调用方按空值降级）
 *   2. 订阅主进程推送的 session 事件
 *   3. 承载参考文件的系统文件框与预览窗能力
 *
 * HTTP 业务调用（chat / models）由 UI 直接 import @ui/http/fetch.ts 发起。
 */

import { shallowRef } from 'vue'

import type { ShallowRef } from 'vue'
import type { Plugin } from '@pkg/cordis'
import type { BootInfo, WindowControlAction } from '@ui/types/ipc.ts'
import type { ReferenceMeta, SessionEvent } from '@pkg/session'

export const BRIDGE_SERVICE = 'electronBridge'

/** Electron 外壳提供给渲染进程的能力。 */
export interface BridgeService {
  /** 控制当前窗口。 */
  controlWindow(action: WindowControlAction): Promise<void>
  /** 查询当前窗口是否已最大化。 */
  isWindowMaximized(): Promise<boolean>
  /** 订阅当前窗口最大化状态变化；返回退订函数。 */
  onWindowMaximizedChanged(listener: (isMaximized: boolean) => void): () => void
  /** 打开系统文件框选择参考文件；返回本地绝对路径，取消时为空数组。 */
  pickReferences(): Promise<string[]>
  /** 打开独立预览窗口；同一路径已打开时聚焦已有窗口。 */
  previewReference(reference: ReferenceMeta): Promise<void>
  /** 订阅会话事件；返回退订函数。 */
  onEvent(listener: (event: SessionEvent) => void): () => void
  /** 订阅插件源码变化（仅开发模式产生）；返回退订函数。 */
  onPluginsChanged(listener: () => void): () => void
  /** 启动信息；拉取完成前为 null。 */
  readonly bootInfo: ShallowRef<BootInfo | null>
}

export const electronBridge: Plugin = {
  name: 'electronBridge',
  apply(ctx) {
    const api = window.bologv
    if (api === undefined) {
      throw new Error('window.bologv 不可用：请通过 Electron 外壳启动 Web UI')
    }

    // 启动信息只服务状态栏显示：装配时即发起；失败保持 null，由读取方按空值降级。
    const bootInfo = shallowRef<BootInfo | null>(null)
    void api.boot()
      .then((info) => {
        bootInfo.value = info
      })
      .catch((error: unknown) => {
        console.error('[electronBridge] 启动信息拉取失败：', error)
      })

    const service: BridgeService = {
      controlWindow: (action) => api.windowControl(action),
      isWindowMaximized: () => api.isWindowMaximized(),
      onWindowMaximizedChanged: (listener) => api.onWindowMaximizedChanged(listener),
      pickReferences: () => api.pickReferenceFiles(),
      previewReference: (reference) => api.previewReference(reference),
      onEvent: (listener) => api.onEvent(listener),
      onPluginsChanged: (listener) => api.onPluginsChanged(listener),
      bootInfo,
    }
    ctx.provide(BRIDGE_SERVICE, service)
  },
}
