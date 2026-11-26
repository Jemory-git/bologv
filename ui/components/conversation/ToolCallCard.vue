<script setup lang="ts">
/**
 * 工具卡片：一次调用与其结果共用一条可折叠记录。
 * 失败结果默认展开，其余收起——主展开/收起由运行组承担。
 */
import { computed } from 'vue'
import type { ToolCallPair } from '@ui/types/view-model.ts'

//states
const props = defineProps<{ pair: ToolCallPair }>()

const status = computed(() => {
  if (props.pair.result === undefined) return 'call'
  return props.pair.result.ok ? 'ok' : 'fail'
})

const label = computed(() => {
  if (props.pair.result === undefined) return '调用中'
  return props.pair.result.ok ? '成功' : '失败'
})

const args = computed(() => JSON.stringify(props.pair.call.args, null, 2))
</script>

<template>
  <details class="tool-card" :class="status" :open="status === 'fail'">
    <summary>
      <span class="name">{{ pair.call.name }}</span>
      <span class="kind">{{ label }}</span>
      <span class="chevron" aria-hidden="true">›</span>
    </summary>
    <pre>{{ args }}</pre>
    <pre v-if="pair.result !== undefined">{{ pair.result.content }}</pre>
  </details>
</template>

<style scoped lang="scss">
.tool-card {
  overflow: hidden;
  border: 0.1rem solid var(--line);
  border-left-width: 0.2rem;
  border-radius: 0.8rem;
  background: var(--panel);

  &.call {
    border-left-color: var(--accent);
  }

  &.ok {
    border-left-color: var(--ok);
  }

  &.fail {
    border-left-color: var(--fail);
  }

  summary {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    padding: 0.7rem 1rem;
    cursor: pointer;
    list-style: none;

    &::-webkit-details-marker {
      display: none;
    }
  }

  .name {
    color: var(--text);
    font: 1.2rem var(--mono);
  }

  .kind {
    padding: 0 0.6rem;
    border-radius: 99.9rem;
    background: var(--panel-2);
    color: var(--muted);
    font: 1.1rem var(--mono);
  }

  &.call .kind {
    color: var(--accent);
  }

  &.ok .kind {
    color: var(--ok);
  }

  &.fail .kind {
    color: var(--fail);
  }

  .chevron {
    margin-left: auto;
    color: var(--muted);
    transition: transform 120ms ease;
  }

  &[open] .chevron {
    transform: rotate(90deg);
  }

  pre {
    max-height: 22rem;
    margin: 0;
    padding: 0.8rem 1rem 1rem;
    overflow: auto;
    border-top: 0.1rem solid var(--line);
    color: var(--muted);
    font: 1.1rem/1.55 var(--mono);
    white-space: pre-wrap;
    word-break: break-word;
  }
}
</style>
