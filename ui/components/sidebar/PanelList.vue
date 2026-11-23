<script setup lang="ts">
  /**
   * 主导航：插件注册到 sidebar.panels 的配对入口。
   *
   * 配对型入口用 PairSlotOutlet（自动注入 active/select）；
   * 不需要关心选中态维护，直接遍历 descriptor.pairs。
   */
  import PairSlotOutlet from '@ui/components/slots/PairSlotOutlet.vue'
  import { sidebarPanels } from '@ui/slots'
</script>

<template>
  <nav class="panel-list" aria-label="主导航">
    <PairSlotOutlet :slot="sidebarPanels" />
  </nav>
</template>

<style scoped lang="scss">
.panel-list {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 1rem 0.8rem;
  border-bottom: 0.1rem solid var(--line);
}
</style>
