/**
 * 窗口控制插件：把一个完整的按钮组注册到应用顶栏右槽。
 * 窗口操作由 WindowControls 经 electronBridge 发起，插槽只负责承载 UI。
 */
import { appHeaderRight } from '@ui/slots'
import WindowControls from './WindowControls.vue'

import type { Plugin } from '@pkg/cordis'

export const windowControls: Plugin = {
  name: 'window-controls',
  apply(ctx) {
    ctx.effect(appHeaderRight.register(WindowControls, () => ({})))
  },
}
