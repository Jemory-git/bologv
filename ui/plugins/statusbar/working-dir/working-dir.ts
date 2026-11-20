import type { Plugin } from '@pkg/cordis'
import { statusbarItems } from '@ui/slots/list/statusbar-items.ts'
import WorkingDirItem from './WorkingDirItem.vue'

export const workingDirItem: Plugin = {
  name: 'working-dir-item',
  apply(ctx) {
    ctx.effect(statusbarItems.register(WorkingDirItem, () => ({})))
  },
}
