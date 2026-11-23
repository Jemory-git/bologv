<script setup lang="ts">
  import type { ExclusiveSlot } from '@ui/slots'

  //props
  defineProps<{ slot: ExclusiveSlot<object> }>()
</script>

<template>
  <component :is="slot.entry.value?.component" v-bind="slot.entry.value?.props()" />
</template>
