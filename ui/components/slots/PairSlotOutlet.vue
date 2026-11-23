<script setup lang="ts">
  /**
   * 配对型插槽渲染出口：消费 PairSlot，只渲染 entry 侧。
   *
   * 用法：<PairSlotOutlet :slot="sidebarPanels" />
   *
   * 每个 entry 会自动收到两个额外 props：
   *   active: boolean —— 当前是否被选中
   *   select: () => void —— 点击时调用以选中
   */
  import type { PairSlot } from '@ui/slots'

  defineProps<{ slot: PairSlot<any, any> }>()
</script>

<template>
  <component v-for="pair in slot.pairs" :key="pair.id" :is="pair.entry.component" @select="() => slot.select(pair.id)" v-bind="{
    ...pair.entry.props(),
    active: slot.activeId.value === pair.id,
  }" />
</template>
