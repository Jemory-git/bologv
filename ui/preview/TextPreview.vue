<script setup lang="ts">
  /** 文本类文档预览：等宽字体、保留原始空白，超长内容由调用方截断。 */
  defineProps<{ text: string; truncated: boolean }>()
</script>

<template>
  <div class="stage">
    <pre class="text">{{ text }}</pre>
    <p v-if="truncated" class="note">文件较大，已截断显示</p>
  </div>
</template>

<style scoped lang="scss">
.stage {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.text {
  flex: 1;
  margin: 0;
  padding: 1.2rem;
  overflow: auto;
  border: 0.1rem solid var(--line);
  border-radius: 0.8rem;
  background: var(--panel);
  color: var(--text);
  font: 1.3rem/1.6 var(--mono);
  white-space: pre;
}

.note {
  margin: 0;
  color: var(--muted);
  font: 1.1rem var(--mono);
}
</style>
