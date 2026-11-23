import type { Plugin } from '@pkg/cordis'
import { statusbarItems } from '@ui/slots'
import SessionPathItem from './SessionPathItem.vue'

export const sessionPathItem: Plugin = {
  name: 'session-path-item',
  apply(ctx) {
    ctx.effect(statusbarItems.register(SessionPathItem, () => ({})))
  },
}
