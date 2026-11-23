<script setup lang="ts">
  /**
   * 对话记录：唯一滚动容器，把事件行映射成消息、工具卡片或系统提示。
   */
  import { computed, nextTick, ref, watch } from 'vue'
  import type { SessionEvent } from '@pkg/session'
  import type { ChatEntry } from '@ui/types/view-model.ts'
  import Empty from './empty.vue'
  import MessageItem from './MessageItem.vue'
  import SystemNotice from './SystemNotice.vue'
  import ToolCallCard from './ToolCallCard.vue'
  import TurnStatus from './TurnStatus.vue'

  type ToolEvent = Extract<SessionEvent, { type: 'tool/call' | 'tool/result' }>

  type Row =
    | { kind: 'notice'; text: string; tone?: 'notice' | 'error' }
    | { kind: 'message'; role: 'user' | 'assistant'; text: string }
    | { kind: 'tool'; event: ToolEvent }

  const props = defineProps<{ entries: readonly ChatEntry[]; pending: boolean }>()

  const emit = defineEmits<{ suggest: [text: string] }>()

  function toRow(entry: ChatEntry): Row {
    if (entry.kind !== 'event') {
      return { kind: 'notice', text: entry.text, tone: entry.kind === 'error' ? 'error' : 'notice' }
    }

    const event = entry.event
    switch (event.type) {
      case 'user/message':
        return { kind: 'message', role: 'user', text: event.text }
      case 'assistant/message':
        return { kind: 'message', role: 'assistant', text: event.text }
      case 'tool/call':
      case 'tool/result':
        return { kind: 'tool', event }
    }
  }

  const rows = computed<Row[]>(() => props.entries.map(toRow))
  const list = ref<HTMLElement | null>(null)

  function scrollToEnd(): void {
    const element = list.value
    if (element !== null) element.scrollTop = element.scrollHeight
  }

  watch(
    () => [props.entries.length, props.pending] as const,
    () => {
      void nextTick(scrollToEnd)
    },
  )
</script>

<template>
  <div ref="list" class="transcript" aria-live="polite">
    <Empty v-if="rows.length === 0" @suggest="emit('suggest', $event)" />
    <template v-for="(row, index) in rows" :key="index">
      <SystemNotice v-if="row.kind === 'notice'" :text="row.text" :tone="row.tone" />
      <MessageItem v-else-if="row.kind === 'message'" :role="row.role" :text="row.text" />
      <ToolCallCard v-else :event="row.event" />
    </template>
    <TurnStatus v-if="pending" />
  </div>
</template>

<style scoped lang="scss">
.transcript {
  width: 70%;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 1.2rem;
  min-height: 0;
  padding: 2rem;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--line) transparent;
}
</style>
