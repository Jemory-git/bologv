<script setup lang="ts">
/**
 * 工具卡片：调用与结果共用一条可折叠记录，失败结果默认展开。
 */
import { computed } from 'vue'
import type { SessionEvent } from '@pkg/session'

type ToolEvent = Extract<SessionEvent, { type: 'tool/call' | 'tool/result' }>

const props = defineProps<{ event: ToolEvent }>()

const status = computed(() => {
  if (props.event.type === 'tool/call') return 'call'
  return props.event.ok ? 'ok' : 'fail'
})

const label = computed(() => {
  if (props.event.type === 'tool/call') return '调用'
  return props.event.ok ? '成功' : '失败'
})

const args = computed(() => {
  const event = props.event
  return event.type === 'tool/call' ? JSON.stringify(event.args, null, 2) : ''
})
</script>

<template>
  <details class="tool-card" :class="status" :open="status === 'fail'">
    <summary>
      <span class="name">{{ event.name }}</span>
      <span class="kind">{{ label }}</span>
      <span class="chevron" aria-hidden="true">›</span>
    </summary>
    <pre v-if="event.type === 'tool/call'">{{ args }}</pre>
    <pre v-else>{{ event.content }}</pre>
  </details>
</template>

<style scoped lang="scss">
.tool-card {
  align-self: flex-start;
  width: min(86%, 72rem);
  margin-left: 3.2rem;
  overflow: hidden;
  border: 0.1rem solid var(--line);
  border-left-width: 0.2rem;
  border-radius: 0.8rem;
  background: var(--panel);
}

.tool-card.call {
  border-left-color: var(--accent);
}

.tool-card.ok {
  border-left-color: var(--ok);
}

.tool-card.fail {
  border-left-color: var(--fail);
}

summary {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.7rem 1rem;
  cursor: pointer;
  list-style: none;
}

summary::-webkit-details-marker {
  display: none;
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

.call .kind {
  color: var(--accent);
}

.ok .kind {
  color: var(--ok);
}

.fail .kind {
  color: var(--fail);
}

.chevron {
  margin-left: auto;
  color: var(--muted);
  transition: transform 120ms ease;
}

details[open] .chevron {
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
</style>
