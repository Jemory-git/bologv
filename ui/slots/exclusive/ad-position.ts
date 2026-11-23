import { ExclusiveSlot } from '../slots.ts'

export const adPositionSlot = new ExclusiveSlot<object>({
  id: 'ad.position',
  label: '侧边栏广告位',
  description: '左侧边栏底部的单槽广告位，同一时间只允许一个组件占用。',
  access: 'builtin-only',
  usage: "import { adPositionSlot } from '@ui/slots'",
})
