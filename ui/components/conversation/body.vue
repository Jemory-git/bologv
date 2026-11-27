<script setup lang="ts">
/**
 * 对话记录：唯一滚动容器，把事件行映射成消息、工具运行组或系统提示。
 * 连续工具事件按轮聚合成一个可折叠运行组；call/result 按 callId 配对。
 */
import { computed, nextTick, ref, watch } from 'vue'
import type { ReferenceMeta } from '@pkg/session'
import type { ChatEntry, ToolCallPair } from '@ui/types/view-model.ts'
import Empty from './empty.vue'
import MessageItem from './MessageItem.vue'
import SystemNotice from './SystemNotice.vue'
import ToolRunGroup from './ToolRunGroup.vue'
import TurnStatus from './TurnStatus.vue'

type Row =
  | { kind: 'notice'; text: string; tone?: 'notice' | 'error' }
  | { kind: 'message'; role: 'user' | 'assistant'; text: string; references?: ReferenceMeta[] }
  | { kind: 'tool-run'; calls: ToolCallPair[] }

//states
const props = defineProps<{ entries: readonly ChatEntry[]; pending: boolean }>()
const list = ref<HTMLElement | null>(null)
const rows = computed<Row[]>(() => groupRows(props.entries))

//methods
/** 消息 / 提示打断分组；两条消息之间的工具事件同属一轮运行。 */
function groupRows(entries: readonly ChatEntry[]): Row[] {
  const rows: Row[] = []
  let run: ToolCallPair[] | null = null

  const beginRun = (): ToolCallPair[] => {
    if (run !== null) return run
    const fresh: ToolCallPair[] = []
    run = fresh
    rows.push({ kind: 'tool-run', calls: fresh })
    return fresh
  }

  for (const entry of entries) {
    if (entry.kind !== 'event') {
      run = null
      rows.push({ kind: 'notice', text: entry.text, tone: entry.kind === 'error' ? 'error' : 'notice' })
      continue
    }

    const event = entry.event
    switch (event.type) {
      case 'user/message':
        run = null
        rows.push({ kind: 'message', role: 'user', text: event.text, references: event.references })
        break
      case 'assistant/message':
        run = null
        // 空文本 assistant 事件仅携带推理信封，不渲染空气泡；run=null 保留工具轮分组边界。
        if (event.text !== '') rows.push({ kind: 'message', role: 'assistant', text: event.text })
        break
      case 'tool/call':
        beginRun().push({ call: event })
        break
      case 'tool/result': {
        const pair = beginRun().find((item) => item.call.callId === event.callId)
        if (pair !== undefined) pair.result = event
        break
      }
    }
  }
  return rows
}

function scrollToEnd(): void {
  const element = list.value
  if (element !== null) element.scrollTop = element.scrollHeight
}

//events
const emit = defineEmits<{ suggest: [text: string] }>()

//hooks
watch(
  () => [props.entries, props.pending] as const,
  () => {
    void nextTick(scrollToEnd)
  },
  { immediate: true },
)
</script>

<template>
  <div ref="list" class="transcript" aria-live="polite">
    <Empty v-if="rows.length === 0" @suggest="emit('suggest', $event)" />
    <template v-for="(row, index) in rows" :key="index">
      <SystemNotice v-if="row.kind === 'notice'" :text="row.text" :tone="row.tone" />
      <MessageItem v-else-if="row.kind === 'message'" :role="row.role" :text="row.text" :references="row.references" />
      <ToolRunGroup v-else :calls="row.calls" :active="pending && index === rows.length - 1" />
    </template>
    <TurnStatus v-if="pending" />
  </div>
</template>

<style scoped lang="scss">
.transcript {
  width: 80%;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 1.6rem;
  min-height: 0;
  padding: 2.4rem 2.4rem 1.2rem;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--bar) transparent;
}
</style>
