/**
 * Chat 面板 header 的动作按钮列表。
 * 位于会话头部右侧，放会话级操作（导出、清空……）。
 */
import { ListSlot } from '../slots.ts'

export interface ChatHeaderActionsProps {
  pending: boolean
}

export const chatHeaderActions = new ListSlot<ChatHeaderActionsProps>({
  id: 'chat.header.actions',
  label: '会话头部动作',
  description: '会话头部右侧，放会话级操作（导出、清空……）。',
  access: 'builtin-only',
  usage: "import { chatHeaderActions } from '@ui/slots'",
})
