/**
 * 插槽清单 —— 插件页「可用插槽」的唯一数据源。
 *
 * 元信息写在各个插槽定义处，这里只做聚合：新增插槽 = 定义处补 meta + 这里加一行。
 * 顺序即展示顺序：外置插件可用的排最前，其余按界面位置从上到下。
 */
import { sidebarPanels } from './pair/sidebar-panels.ts'
import { appHeaderLeft, appHeaderRight } from './list/app-header.ts'
import { chatHeaderActions } from './list/chat-header-actions.ts'
import { chatComposerActions } from './list/chat-composer-actions.ts'
import { statusbarItems } from './list/statusbar-items.ts'
import { adPositionSlot } from './exclusive/ad-position.ts'

import type { SlotDescriptor } from './types.ts'

export const SLOT_CATALOG: readonly SlotDescriptor[] = [
  sidebarPanels,
  appHeaderLeft,
  appHeaderRight,
  chatHeaderActions,
  chatComposerActions,
  statusbarItems,
  adPositionSlot,
]
