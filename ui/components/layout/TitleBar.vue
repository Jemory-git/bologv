<script setup lang="ts">
/**
 * 顶部应用栏：窗口拖拽区、品牌、模型标识与插件扩展位。
 */
import SlotOutlet from '@ui/components/slots/SlotOutlet.vue'
import { appHeaderActions } from '@ui/slots/list/app-header-actions.ts'

defineProps<{ model: string; pending: boolean }>()
</script>

<template>
  <div class="titlebar-content">
    <span class="badge">{{ model }}</span>
    <span v-if="pending" class="busy">处理中</span>
    <div class="actions">
      <SlotOutlet :slot="appHeaderActions" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.titlebar-content {
  display: flex;
  align-items: center;
  gap: 1.2rem;
  width: 100%;
  height: 100%;
  padding: 0 1.4rem;
  -webkit-app-region: drag;
}

.badge {
  padding: 0.1rem 0.8rem;
  border: 0.1rem solid var(--line);
  border-radius: 99.9rem;
  color: var(--muted);
  font: 1.1rem var(--mono);
}

.busy {
  color: var(--accent);
  font-size: 1.2rem;
}

.actions {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  margin-left: auto;
  -webkit-app-region: no-drag;
}
</style>
