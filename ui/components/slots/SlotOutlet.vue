<script setup lang="ts">
/**
 * 列表型插槽渲染出口：消费 ListSlot。
 *
 * 用法：<SlotOutlet :slot="statusbarItems" />
 * 插槽实例自身是响应式的，entries 直接 v-for 即可。
 */
import type { ListSlot } from '@ui/slots/slots.ts'

defineProps<{ slot: ListSlot<any> }>()
</script>

<template>
  <component
    v-for="entry in slot.entries"
    :key="entry.id"
    :is="entry.component"
    v-bind="entry.props()"
  />
</template>
