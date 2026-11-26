<script setup lang="ts">
/**
 * 一轮工具运行过程：把本轮所有工具调用聚合为一条可折叠记录。
 * 运行中自动展开便于观察进度；本轮结束（active 变 false）自动收起，历史保持紧凑。
 * 摘要给出调用次数与汇总状态；失败标红，展开即可逐条检查。
 */
import { computed, ref, watch } from 'vue'
import type { ToolCallPair } from '@ui/types/view-model.ts'
import ToolCallCard from './ToolCallCard.vue'

//states
const props = defineProps<{ calls: readonly ToolCallPair[]; active: boolean }>()
const expanded = ref(props.active)

const failCount = computed(() => props.calls.filter((item) => item.result !== undefined && !item.result.ok).length)

const status = computed(() => {
  if (props.active) return 'running'
  return failCount.value > 0 ? 'fail' : 'ok'
})

const statusLabel = computed(() => {
  if (props.active) return '执行中'
  return failCount.value > 0 ? `${failCount.value} 失败` : '完成'
})

//methods
function onToggle(event: Event): void {
  expanded.value = (event.target as HTMLDetailsElement).open
}

//hooks
watch(() => props.active, (active) => {
  expanded.value = active
})
</script>

<template>
  <details class="tool-run" :class="status" :open="expanded" @toggle="onToggle">
    <summary>
      <span class="title">运行过程</span>
      <span class="count">{{ calls.length }} 次调用</span>
      <span class="kind">{{ statusLabel }}</span>
      <span class="chevron" aria-hidden="true">›</span>
    </summary>
    <div class="cards">
      <ToolCallCard v-for="item in calls" :key="item.call.callId" :pair="item" />
    </div>
  </details>
</template>

<style scoped lang="scss">
.tool-run {
  align-self: flex-start;
  width: min(86%, 72rem);
  margin-left: 3.2rem;
  // overflow: hidden;
  border: 0.1rem solid var(--line);
  border-left-width: 0.2rem;
  border-radius: 0.8rem;
  background: var(--panel);

  &.running {
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

  .title {
    color: var(--text);
    font: 1.2rem var(--mono);
  }

  .count {
    color: var(--muted);
    font: 1.1rem var(--mono);
  }

  .kind {
    padding: 0 0.6rem;
    border-radius: 99.9rem;
    background: var(--panel-2);
    color: var(--muted);
    font: 1.1rem var(--mono);
  }

  &.running .kind {
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

  .cards {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    padding: 0.8rem 1rem 1rem;
    border-top: 0.1rem solid var(--line);
  }
}
</style>
