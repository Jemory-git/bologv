import { statusbarItems } from '@ui/slots'
import Reload from './Reload.vue'

import type { Plugin } from '@pkg/cordis'

export const reloadBtn: Plugin = {
  name: 'reload-btn',
  apply(ctx) {
    ctx.effect(statusbarItems.register(Reload, () => ({})))
  },
}
