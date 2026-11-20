import type { Plugin } from '@pkg/cordis'
import { statusbarItems } from '@ui/slots/list/statusbar-items.ts'
import VersionItem from './VersionItem.vue'

export const versionItem: Plugin = {
  name: 'version-item',
  apply(ctx) {
    ctx.effect(statusbarItems.register(VersionItem, () => ({})))
  },
}
