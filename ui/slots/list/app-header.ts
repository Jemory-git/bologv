/**
 * 应用级 header 的左右插槽。
 * 两个插槽各占顶栏一半，承载全局扩展内容。
 * 条目组件自行取用自己需要的服务，不让通用插槽耦合具体业务 Props。
 */
import { ListSlot } from '../slots.ts'

export const appHeaderLeft = new ListSlot<object>({
  id: 'app.header.left',
  label: '顶栏左侧',
  description: '窗口顶部栏左半区；按注册顺序从左向右排列，后注册的条目靠右。',
  access: 'builtin-only',
  usage: "import { appHeaderLeft } from '@ui/slots'",
})

export const appHeaderRight = new ListSlot<object>({
  id: 'app.header.right',
  label: '顶栏右侧',
  description: '窗口顶部栏右半区；按注册顺序从右向左排列，后注册的条目靠左。',
  access: 'builtin-only',
  usage: "import { appHeaderRight } from '@ui/slots'",
})
