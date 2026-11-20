<script setup lang="ts">
/**
 * 状态栏常驻告警：会话持久化失败时显示，直到下一次成功保存。
 * 数据来自 status store；健康时不渲染，不占布局。
 */
import { useStatusStore } from '@ui/stores/status.ts'

//states
const status = useStatusStore()
</script>

<template>
  <div v-if="status.storageError" class="storage-alert" :title="status.storageError ?? undefined">
    <span class="text">{{ status.storageError }}</span>
  </div>
</template>

<style scoped lang="scss">
.storage-alert {
  flex: 0 1 auto;
  max-width: 60%;
  min-width: 0;
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0 1.2rem;
  color: var(--fail);
  font-size: 1.1rem;
  font-family: var(--mono);

  .text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
