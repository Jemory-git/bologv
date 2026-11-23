/**
 * Chat 输入框区域的动作按钮列表。
 * 位于 composer 左侧，放快捷输入类按钮（上传、粘贴、模板……）。
 */
import { ListSlot } from '../slots.ts'

export interface ChatComposerActionsProps {
  pending: boolean
}

export const chatComposerActions = new ListSlot<ChatComposerActionsProps>({
  id: 'chat.composer.actions',
  label: '输入框动作',
  description: '输入框左侧，放快捷输入类按钮（上传、粘贴、模板……）。',
  access: 'builtin-only',
  usage: "import { chatComposerActions } from '@ui/slots'",
})
