<script setup lang="ts">
/**
 * 系统提示：恢复日志、欢迎语或错误信息。
 */
defineProps<{ text: string; tone?: 'notice' | 'error' }>()
</script>

<template>
  <div :class="['system-notice', tone ?? 'notice']">{{ text }}</div>
</template>

<style scoped lang="scss">
.system-notice {
  align-self: center;
  padding: 0.4rem 1rem;
  border-radius: 99.9rem;
  color: var(--muted);
  font-size: 1.1rem;
  text-align: center;
}

.system-notice.error {
  color: var(--fail);
}
</style>
