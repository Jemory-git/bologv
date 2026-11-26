/**
 * 插槽统一出口 —— re-export 所有公开 API。
 *
 * 使用方式：插件/组件直接从子模块 import 具体实例，
 * 不经过 Registry 间接派发。见各子文件注释。
 *
 *   import { sidebarPanels } from '@ui/slots'
 *   import { appHeaderLeft, appHeaderRight } from '@ui/slots'
 */

// 类型 + 基类
export type {
  PairEntry,
  PairEntryControl,
  SlotAccess,
  SlotDescriptor,
  SlotEntry,
  SlotKind,
  SlotMeta,
  SlotMetaInput,
} from './types.ts'
export { ListSlot, PairSlot, ExclusiveSlot, SlotBase } from './slots.ts'

// 插槽清单（插件页读取）
export { SLOT_CATALOG } from './catalog.ts'

// exclusive 插槽实例
export { adPositionSlot } from './exclusive/ad-position.ts'

// List 插槽实例
export { appHeaderLeft, appHeaderRight } from './list/app-header.ts'
export { chatHeaderActions } from './list/chat-header-actions.ts'
export type { ChatHeaderActionsProps } from './list/chat-header-actions.ts'
export { chatComposerActions } from './list/chat-composer-actions.ts'
export type { ChatComposerActionsProps } from './list/chat-composer-actions.ts'
export { statusbarItems } from './list/statusbar-items.ts'

// Pair 插槽实例
export { sidebarPanels } from './pair/sidebar-panels.ts'
export type { SidebarPanelEntryProps, SidebarPanelViewProps } from './pair/sidebar-panels.ts'
