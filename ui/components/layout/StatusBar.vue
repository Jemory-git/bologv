<script setup lang="ts">
/**
 * 底部状态栏：只负责容器布局，所有具体条目由 ListSlot "statusbar.items" 的插件注册。
 */
import SlotOutlet from '@ui/components/slots/SlotOutlet.vue'
import { statusbarItems } from '@ui/slots/list/statusbar-items.ts'
</script>

<template>
  <div class="statusbar-content">
    <SlotOutlet :slot="statusbarItems" />
  </div>
</template>

<style scoped lang="scss">
.statusbar-content {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.8rem;
  flex: 1;
  padding: 0 1.2rem;
  overflow: hidden;
  color: var(--muted);
  font: 1.1rem var(--mono);
  white-space: nowrap;
}
</style>
