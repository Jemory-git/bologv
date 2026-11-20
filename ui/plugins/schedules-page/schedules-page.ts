/**
 * schedules-page 插件：向 sidebar.panels 配对插槽注册一个入口 + 一个主区域视图。
 * 目录约定见 plugins-page/plugins-page.ts。
 */

import type { Plugin } from '@pkg/cordis'
import PanelEntry from '@ui/components/sidebar/PanelEntry.vue'
import { sidebarPanels } from '@ui/slots/pair/sidebar-panels.ts'
import SchedulesView from './SchedulesView.vue'

export const schedulesPage: Plugin = {
  name: 'schedules-page',
  apply(ctx) {
    ctx.effect(
      sidebarPanels.register(
        'schedules',
        { component: PanelEntry, props: () => ({ label: '自动化任务' }) },
        { component: SchedulesView, props: () => ({}) },
      ),
    )
  },
}
