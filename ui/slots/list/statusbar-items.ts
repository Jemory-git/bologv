/**
 * 状态栏条目列表。
 * 条目组件自己从 AppState / Connection 等 service 取数据，props 留空。
 */
import { ListSlot } from '../slots.ts'

export const statusbarItems = new ListSlot<Record<string, never>>(
  'statusbar.items',
)
