/**
 * Chat 输入框区域的动作按钮列表。
 * 位于 composer 左侧，放快捷输入类按钮（上传、粘贴、模板……）。
 */
import { ListSlot } from '../slots.ts'

export interface ChatComposerActionsProps {
  pending: boolean
}

export const chatComposerActions = new ListSlot<ChatComposerActionsProps>(
  'chat.composer.actions',
)
