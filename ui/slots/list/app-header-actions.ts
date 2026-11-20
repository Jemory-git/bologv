/**
 * 应用级 header 的动作按钮列表。
 * 位于窗口顶部栏右侧，放全局可用的操作（设置、关于……）。
 */
import { ListSlot } from '../slots.ts'

export interface AppHeaderActionsProps {
  /** 当前是否有正在执行的 agent loop——按钮可以据此显示 loading 态。 */
  pending: boolean
}

export const appHeaderActions = new ListSlot<AppHeaderActionsProps>(
  'app.header.actions',
)
