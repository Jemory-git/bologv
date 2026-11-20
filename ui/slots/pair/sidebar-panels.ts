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

export interface SidebarPanelViewProps extends Record<string, unknown> {}

export const sidebarPanels = new PairSlot<SidebarPanelEntryProps, SidebarPanelViewProps>(
  'sidebar.panels',
)
