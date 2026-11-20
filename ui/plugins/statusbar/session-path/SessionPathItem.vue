<script setup lang="ts">
import { computed } from 'vue'
import { BRIDGE_SERVICE, type BridgeService } from '@ui/plugins/core/electron-bridge.ts'
import { useService } from '@ui/use'

const bridge = useService<BridgeService>(BRIDGE_SERVICE)
const sessionPath = computed(() => bridge.bootInfo.value?.sessionPath ?? null)
</script>

<template>
  <span class="item" :title="sessionPath ?? undefined">{{ sessionPath ?? '—' }}</span>
</template>

<style scoped>
.item {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
