/**
 * 插槽统一出口 —— re-export 所有公开 API。
 *
 * 使用方式：插件/组件直接从子模块 import 具体实例，
 * 不经过 Registry 间接派发。见各子文件注释。
 *
 *   import { sidebarPanels } from '@ui/slots/pair/sidebar-panels.ts'
 *   import { appHeaderActions } from '@ui/slots/list/app-header-actions.ts'
 */

// 类型 + 基类
export type { PairEntry, SlotEntry } from './types.ts'
export { ListSlot, PairSlot, SingleSlot } from './slots.ts'

// List 插槽实例
export { appHeaderActions } from './list/app-header-actions.ts'
export type { AppHeaderActionsProps } from './list/app-header-actions.ts'
export { chatHeaderActions } from './list/chat-header-actions.ts'
export type { ChatHeaderActionsProps } from './list/chat-header-actions.ts'
export { chatComposerActions } from './list/chat-composer-actions.ts'
export type { ChatComposerActionsProps } from './list/chat-composer-actions.ts'
export { statusbarItems } from './list/statusbar-items.ts'

// Pair 插槽实例
export { sidebarPanels } from './pair/sidebar-panels.ts'
export type { SidebarPanelEntryProps, SidebarPanelViewProps } from './pair/sidebar-panels.ts'
