<script setup lang="ts">
/**
 * 单条对话消息：用户靠右，助手靠左并带标识。
 * 用户消息可携带参考文件，平铺展示名称与「类别 + 同类序号」徽标。
 */
import { computed } from 'vue'
import { referenceLabels } from '@pkg/session/types.ts'
import ReferenceCard from './reference/ReferenceCard.vue'
import type { ReferenceMeta } from '@pkg/session/types.ts'

//states
const props = defineProps<{
  role: 'user' | 'assistant'
  text: string
  references?: ReferenceMeta[]
}>()

/** 与投影时模型看到的「图片 1」一一对应。 */
const labels = computed(() => referenceLabels(props.references ?? []))
</script>

<template>
  <div :class="['message', role]">
    <span v-if="role === 'assistant'" class="avatar" aria-hidden="true">d</span>
    <div class="bubble">
      <span class="who">{{ role === 'user' ? '你' : 'BLG' }}</span>
      <p v-if="text !== ''">{{ text }}</p>
      <div v-if="references !== undefined && references.length > 0" class="refs">
        <ReferenceCard v-for="(reference, index) in references" :key="reference.path" :reference="reference"
          :label="labels[index] ?? ''" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.message {
  display: flex;
  align-items: flex-start;
  gap: 0.8rem;
  max-width: min(86%, 100rem);
}

.message.user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.message.assistant {
  align-self: flex-start;
}

.avatar {
  display: grid;
  flex: none;
  place-items: center;
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 99.9rem;
  background: var(--accent);
  color: #08111d;
  font: 600 1.1rem var(--mono);
}

.bubble {
  min-width: 0;
  padding: 0.8rem 1.2rem;
  border: 0.1rem solid var(--line);
  border-radius: 1rem;
  background: var(--panel);
}

.user .bubble {
  border-color: var(--accent-line);
  background: var(--accent-soft);
}

.who {
  display: block;
  margin-bottom: 0.2rem;
  color: var(--muted);
  font: 1.1rem var(--mono);
}

.user .who {
  color: var(--accent);
  text-align: right;
}

p {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.refs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 0.8rem;
}
</style>
