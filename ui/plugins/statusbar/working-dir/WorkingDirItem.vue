<script setup lang="ts">
import { computed } from 'vue'
import { BRIDGE_SERVICE, type BridgeService } from '@ui/plugins/core/electron-bridge.ts'
import { useService } from '@ui/use'

const bridge = useService<BridgeService>(BRIDGE_SERVICE)
const workingDir = computed(() => bridge.bootInfo.value?.workingDir ?? null)
</script>

<template>
  <span class="item" :title="workingDir ?? undefined">{{ workingDir ?? '—' }}</span>
</template>

<style scoped>
.item {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
