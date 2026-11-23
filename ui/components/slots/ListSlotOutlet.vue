<script setup lang="ts">
  /**
   * 列表型插槽渲染出口：消费 ListSlot。
   *
   * 默认按注册顺序渲染；reverse 用于后注册条目需要靠左显示的区域。
   * 插槽实例自身是响应式的，entries 直接 v-for 即可。
   */
  import { computed } from 'vue'

  import type { ListSlot } from '@ui/slots'

  const props = withDefaults(defineProps<{
    slot: ListSlot<any>
    reverse?: boolean
  }>(), {
    reverse: false,
  })

  const entries = computed(() => {
    const registered = [...props.slot.entries]
    return props.reverse ? registered.reverse() : registered
  })
</script>

<template>
  <component v-for="entry in entries" :key="entry.id" :is="entry.component" v-bind="entry.props()" />
</template>
