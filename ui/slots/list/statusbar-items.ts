/**
 * 状态栏条目列表。
 * 内置条目组件自己从 AppState / Connection 等 service 取数据，props 留空；
 * 外置条目经 host.ui.registerStatusBar 注册，由宿主包装成内联视图。
 *
 * 泛型只表达「渲染出口会 v-bind 一份 props」，具体形状由各注册方自行约定，
 * 因此不约束索引签名 —— 否则具名接口类型会被误判为不可赋值。
 */
import { ListSlot } from '../slots.ts'

export const statusbarItems = new ListSlot<object>({
  id: 'statusbar.items',
  label: '状态栏信息条',
  description: '底部状态栏右侧的并列条目；外置条目由内联容器承载，颜色与字号继承状态栏。',
  access: 'external',
  usage: 'host.ui.registerStatusBar({ component | mount })',
})
