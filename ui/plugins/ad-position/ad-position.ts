import type { Plugin } from '@pkg/cordis'
import { adPositionSlot } from '@ui/slots'
import AdPosition from './AdPosition.vue'

export const adPosition: Plugin = {
  name: 'ad-position',
  apply(ctx) {
    ctx.effect(adPositionSlot.register(AdPosition, () => ({})))
  },
}
