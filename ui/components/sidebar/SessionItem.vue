<script setup lang="ts">
/**
 * 单条会话：点击选中，右侧「…」按钮（hover 时显示）打开操作菜单；
 * editing 时标题变成内联输入框。
 *
 * - 选中态由父组件传入 active prop（比对 chat.currentSessionId）
 * - 重命名提交 emit('rename', id, title)；取消 emit('cancel-rename')
 */
import { nextTick, ref, watch } from 'vue'
import IconMore from '~icons/icon-park-outline/more'
import type { SessionSummary } from '@ui/types/view-model.ts'

const props = defineProps<{
  session: SessionSummary
  active: boolean
  editing: boolean
  /** 该会话的操作菜单是否打开；用于 aria-expanded。 */
  menuOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'clickMore', id: string, x: number, y: number): void
  (e: 'rename', id: string, title: string): void
  (e: 'cancel-rename'): void
}>()

//states
const draft = ref('')
const input = ref<HTMLInputElement | null>(null)
/** 防止 Enter / Esc 与 blur 重复提交。 */
let finished = false

//methods
function onSelect(): void {
  if (!props.editing) emit('select', props.session.id)
}

function onMore(event: MouseEvent): void {
  const trigger = event.currentTarget as HTMLElement
  const rect = trigger.getBoundingClientRect()
  emit('clickMore', props.session.id, rect.right - 140, rect.bottom + 4)
}

function commit(): void {
  if (finished) return
  finished = true
  const title = draft.value.trim()
  if (title === '' || title === props.session.title) emit('cancel-rename')
  else emit('rename', props.session.id, title)
}

function cancel(): void {
  if (finished) return
  finished = true
  emit('cancel-rename')
}

//hooks
watch(
  () => props.editing,
  async (editing) => {
    if (!editing) return
    finished = false
    draft.value = props.session.title
    await nextTick()
    input.value?.focus()
    input.value?.select()
  },
  { immediate: true },
)
</script>

<template>
  <div class="session-item" :class="{ active }" role="button" tabindex="0" @click="onSelect"
    @keydown.enter.prevent="onSelect" @keydown.space.prevent="onSelect">
    <span class="mark" aria-hidden="true" />
    <span class="body">
      <input v-if="editing" ref="input" v-model="draft" class="title-input" type="text" maxlength="100"
        @keydown.enter.prevent="commit" @keydown.esc.prevent="cancel" @blur="commit" @click.stop />
      <span v-else class="title">{{ props.session.title }}</span>
      <span v-if="props.session.subtitle" class="subtitle">{{ props.session.subtitle }}</span>
    </span>
    <button v-if="!editing" class="more" type="button" data-session-menu-trigger aria-label="会话操作" aria-haspopup="menu"
      :aria-expanded="props.menuOpen" @click.stop="onMore">
      <IconMore />
    </button>
  </div>
</template>

<style scoped lang="scss">
.session-item {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  width: 100%;
  padding: 0.8rem 1rem;
  border: 0.1rem solid transparent;
  border-radius: 0.8rem;
  background: transparent;
  color: var(--text);
  text-align: left;
  cursor: pointer;

  &:hover {
    background: var(--panel-2);
  }

  &:focus-visible {
    outline: 0.1rem solid var(--accent-line);
    outline-offset: -0.1rem;
  }

  &.active {
    border-color: var(--accent-line);
    background: var(--accent-soft);
  }

  .mark {
    width: 0.7rem;
    height: 0.7rem;
    flex: none;
    border-radius: 99.9rem;
    background: transparent;
  }

  &.active .mark {
    background: var(--accent);
  }

  .body {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  .title {
    overflow: hidden;
    font-size: 1.3rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .title-input {
    width: 100%;
    padding: 0.1rem 0.4rem;
    border: 0.1rem solid var(--accent-line);
    border-radius: 0.4rem;
    background: var(--panel-2);
    color: var(--text);
    font-size: 1.3rem;

    &:focus {
      outline: none;
    }
  }

  .subtitle {
    overflow: hidden;
    color: var(--muted);
    font: 1.1rem var(--mono);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .more {
    display: grid;
    place-items: center;
    width: 2.4rem;
    height: 2.4rem;
    padding: 0;
    flex: none;
    border: 0;
    border-radius: 0.5rem;
    background: transparent;
    color: var(--muted);
    font-size: 1.6rem;
    opacity: 0;
    cursor: pointer;
    transition: opacity 0.12s ease, background 0.12s ease, color 0.12s ease;

    &:hover {
      background: var(--panel);
      color: var(--text);
    }
  }

  &:hover .more,
  &:focus-within .more {
    opacity: 1;
  }
}
</style>
