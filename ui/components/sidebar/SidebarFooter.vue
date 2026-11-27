<script setup lang="ts">
  /**
   * 侧边栏底部：设置按钮 + 弹出面板。
   *
   * 面板是各类配置的入口，点击后由 App 打开对应模态窗。
   * 弹出层用纯 CSS 定位，点击外部自动关闭。
   */
  import { onMounted, onUnmounted, ref } from 'vue'
  import IconSettings from '~icons/icon-park-outline/config'
  import ExclusiveSlotOutlet from '@ui/components/slots/ExclusiveSlotOutlet.vue'
  import { adPositionSlot } from '@ui/slots'

  const popoverRef = ref<HTMLElement | null>(null)
  const open = ref(false)

  function toggle(): void {
    open.value = !open.value
  }

  function onDocumentClick(e: MouseEvent): void {
    if (!open.value) return
    if (popoverRef.value && !popoverRef.value.contains(e.target as Node)) {
      open.value = false
    }
  }

  onMounted(() => {
    document.addEventListener('click', onDocumentClick)
  })
  onUnmounted(() => {
    document.removeEventListener('click', onDocumentClick)
  })

  const emit = defineEmits<{
    (e: 'open-model'): void
    (e: 'open-tools'): void
    (e: 'open-workspace'): void
  }>()

  function handleItem(name: string): void {
    open.value = false
    if (name === 'model') emit('open-model')
    else if (name === 'tools') emit('open-tools')
    else if (name === 'workspace') emit('open-workspace')
    // TODO: system prompt 配置
  }
</script>

<template>
  <div ref="popoverRef" class="sidebar-footer">
    <button type="button" class="settings-btn" :class="{ active: open }" aria-label="设置" :aria-expanded="open" aria-controls="settings-popover" @click="toggle">
      <IconSettings :size="16" />
    </button>

    <ExclusiveSlotOutlet :slot="adPositionSlot" />

    <div v-if="open" id="settings-popover" class="popover" role="menu">
      <button type="button" class="item" role="menuitem" @click="handleItem('model')">
        配置模型
      </button>
      <button type="button" class="item" role="menuitem" @click="handleItem('tools')">
        配置工具
      </button>
      <button type="button" class="item" role="menuitem" @click="handleItem('workspace')">
        配置工作目录
      </button>
      <button type="button" class="item" role="menuitem" @click="handleItem('system')">
        配置 System Prompt
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.sidebar-footer {
  position: relative;
  padding: 0.8rem 1.2rem 1.2rem;
  // border-top: 0.1rem solid var(--line);
}

.settings-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3.2rem;
  height: 3.2rem;
  border: none;
  border-radius: 0.8rem;
  background: transparent;
  color: var(--muted);
  cursor: pointer;

  &:hover {
    background: var(--panel-2);
    color: var(--text);
  }

  &.active {
    background: var(--panel-2);
    color: var(--text);
  }
}

.popover {
  position: absolute;
  right: 1.2rem;
  bottom: 4.8rem;
  min-width: 20rem;
  padding: 0.4rem;
  border: 0.1rem solid var(--line);
  border-radius: 0.8rem;
  background: var(--panel);
  box-shadow: 0 0.8rem 2.4rem rgba(0, 0, 0, 0.4);
}

.item {
  display: block;
  width: 100%;
  padding: 0.8rem 1rem;
  border: none;
  border-radius: 0.4rem;
  background: transparent;
  color: var(--text);
  font-size: 1.3rem;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: var(--panel-2);
  }
}
</style>
