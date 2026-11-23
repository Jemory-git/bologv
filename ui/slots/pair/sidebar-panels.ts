/**
 * 侧边栏面板配对插槽。
 * 每个插件注册一对 entry（侧边栏入口按钮）+ view（主区域显示的完整视图）。
 * 点击 entry 切换 activeId；activeId === null 时 MainPanel 渲染默认 ChatView。
 */
import { PairSlot } from '../slots.ts'

export interface SidebarPanelEntryProps {
  /** 侧边栏入口按钮上显示的文字。 */
  label: string
}

/**
 * 视图 props 由各注册方自行约定形状，Main.vue 只负责 v-bind。
 * 因此这里不约束索引签名 —— 否则具名接口类型会被误判为不可赋值。
 */
export type SidebarPanelViewProps = object

export const sidebarPanels = new PairSlot<SidebarPanelEntryProps, SidebarPanelViewProps>({
  id: 'sidebar.panels',
  label: '侧边栏面板',
  description: '侧边栏入口 + 主区域视图成对注册；点击入口切换主区域，外置插件经 host.ui.registerPanel 注册。',
  access: 'external',
  usage: 'host.ui.registerPanel({ id, label, component | mount })',
})
