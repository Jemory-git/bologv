/**
 * plugins-page 插件：向 sidebar.panels 配对插槽注册一个入口 + 一个主区域视图。
 *
 * UI 插件目录约定：
 *   plugins-page/
 *     plugins-page.ts   ← 本文件，Plugin 定义
 *     PluginsView.vue   ← 私有主视图
 *
 * 共享组件（PanelEntry.vue）放在 components/sidebar/ 下，跨插件复用。
 *
 * 插槽 descriptor 是模块级单例，直接 import 即可使用，
 * 不需要 inject SlotRegistry。
 */

import type { Plugin } from '@pkg/cordis'
import PanelEntry from '@ui/components/sidebar/PanelEntry.vue'
import { sidebarPanels } from '@ui/slots/pair/sidebar-panels.ts'
import PluginsView from './PluginsView.vue'

export const pluginsPage: Plugin = {
  name: 'plugins-page',
  apply(ctx) {
    ctx.effect(
      sidebarPanels.register(
        'plugins',
        { component: PanelEntry, props: () => ({ label: '插件' }) },
        { component: PluginsView, props: () => ({}) },
      ),
    )
  },
}
