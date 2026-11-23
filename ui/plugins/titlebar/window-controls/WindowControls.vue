<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import IconClose from '~icons/icon-park-outline/close'
import IconFullScreen from '~icons/icon-park-outline/full-screen'
import IconMinus from '~icons/icon-park-outline/minus'
import IconOffScreen from '~icons/icon-park-outline/off-screen'
import { BRIDGE_SERVICE } from '@ui/plugins/core/electron-bridge.ts'
import { useService } from '@ui/use'

import type { BridgeService } from '@ui/plugins/core/electron-bridge.ts'
import type { WindowControlAction } from '@ui/types/ipc.ts'

//states
const bridge = useService<BridgeService>(BRIDGE_SERVICE)
const maximized = ref(false)
const maximizeLabel = computed(() => maximized.value ? '还原' : '最大化')
let stopMaximizedListener: (() => void) | undefined

//methods
function control(action: WindowControlAction): void {
  void bridge.controlWindow(action)
}

//hooks
onMounted(() => {
  // 先订阅再查询，覆盖初始化期间发生的最大化状态变化。
  stopMaximizedListener = bridge.onWindowMaximizedChanged((value) => {
    maximized.value = value
  })
  void bridge.isWindowMaximized().then((value) => {
    maximized.value = value
  })
})

onBeforeUnmount(() => stopMaximizedListener?.())
</script>

<template>
  <div class="window-controls" role="group" aria-label="窗口控制">
    <button type="button" class="control" title="最小化" aria-label="最小化" @click="control('minimize')">
      <IconMinus />
    </button>
    <button type="button" class="control" :title="maximizeLabel" :aria-label="maximizeLabel"
      @click="control('toggle-maximize')">
      <IconOffScreen v-if="maximized" />
      <IconFullScreen v-else />
    </button>
    <button type="button" class="control close" title="关闭" aria-label="关闭" @click="control('close')">
      <IconClose />
    </button>
  </div>
</template>

<style scoped lang="scss">
.window-controls {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  height: var(--titlebar-height);

  .control {
    display: grid;
    place-items: center;
    width: 3rem;
    height: 50%;
    padding: 0;
    border: 0;
    gap: 0.5rem;
    background: transparent;
    color: var(--muted);
    cursor: pointer;

    &:hover {
      color: var(--text);
    }

    &:focus-visible {
      outline: 0.1rem solid var(--accent-line);
      outline-offset: -0.1rem;
    }

    &.close:hover {
      color: #fff;
    }

    svg {
      width: 1.4rem;
      height: 1.4rem;
    }
  }
}
</style>
