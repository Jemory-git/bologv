<script setup lang="ts">
/**
 * 对话模型选择器：胶囊展示当前模型，点击向上弹出候选列表。
 *
 * 只列 language 类别（models store 的 chatModels 已过滤），按厂商分组。
 * 选中直接写回 store，TitleBar / Header 的模型标识随响应式自动同步。
 * 打开期间监听点击外部与 Escape 关闭；面板向上弹出，避免遮挡输入区。
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useModelsStore } from '@ui/stores/models.ts'

import type { ChatModelOption } from '@ui/stores/models.ts'

interface ModelGroup {
  id: string
  name: string
  options: ChatModelOption[]
}

//states
const models = useModelsStore()
const root = ref<HTMLElement | null>(null)
const open = ref(false)

//computed
const groups = computed<ModelGroup[]>(() => {
  const result: ModelGroup[] = []
  for (const option of models.chatModels) {
    let group = result.find((item) => item.id === option.vendor.id)
    if (group === undefined) {
      group = { id: option.vendor.id, name: option.vendor.name, options: [] }
      result.push(group)
    }
    group.options.push(option)
  }
  return result
})

const currentLabel = computed(() => models.selectedModelId ?? '未配置模型')

//methods
function toggle(): void {
  open.value = !open.value
}

function select(modelId: string): void {
  models.selectedModelId = modelId
  open.value = false
}

function onPointerDown(event: PointerEvent): void {
  if (root.value !== null && root.value.contains(event.target as Node)) return
  open.value = false
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape') open.value = false
}

//hooks
watch(open, (value) => {
  if (value) {
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown)
  } else {
    window.removeEventListener('pointerdown', onPointerDown, true)
    window.removeEventListener('keydown', onKeyDown)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', onPointerDown, true)
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <div ref="root" class="model-picker">
    <button type="button" class="trigger" :class="{ open }" title="选择对话模型" aria-haspopup="listbox" :aria-expanded="open"
      @click="toggle">
      <span class="name">{{ currentLabel }}</span>
      <span class="caret" aria-hidden="true" />
    </button>

    <div v-if="open" class="panel" role="listbox" aria-label="对话模型">
      <div v-for="group in groups" :key="group.id" class="group">
        <p class="group-title">{{ group.name || '(未命名厂商)' }}</p>
        <button v-for="option in group.options" :key="option.model.modelId" type="button" role="option" class="option"
          :class="{ active: option.model.modelId === models.selectedModelId }"
          :aria-selected="option.model.modelId === models.selectedModelId" @click="select(option.model.modelId)">
          <span class="option-name">{{ option.model.modelId }}</span>
          <span v-if="option.model.modelId === models.selectedModelId" class="tick" aria-hidden="true">✓</span>
        </button>
      </div>
      <p v-if="groups.length === 0" class="empty">还没有语言模型，请先到「配置模型」中添加</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.model-picker {
  position: relative;
  display: flex;
  min-width: 0;
}

/* —— 触发胶囊 —— */
.trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
  max-width: 28rem;
  padding: 0.55rem 1.1rem;
  border: 0.1rem solid var(--line);
  border-radius: 99.9rem;
  background: transparent;
  color: var(--muted);
  font-size: 1.15rem;
  cursor: pointer;
  transition:
    border-color 0.14s,
    background 0.14s,
    color 0.14s;

  &:hover,
  &.open {
    border-color: var(--accent-line);
    background: var(--panel-2);
    color: var(--text);
  }

  .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .caret {
    flex: none;
    width: 0;
    height: 0;
    border-right: 0.35rem solid transparent;
    border-left: 0.35rem solid transparent;
    border-top: 0.4rem solid currentcolor;
    transition: transform 0.14s;
  }

  &.open .caret {
    transform: rotate(180deg);
  }
}

/* —— 向上弹出的候选面板 —— */
.panel {
  position: absolute;
  right: 0;
  bottom: calc(100% + 0.8rem);
  z-index: 50;
  width: 30rem;
  max-height: 32rem;
  padding: 0.5rem;
  overflow-y: auto;
  border: 0.1rem solid var(--line);
  border-radius: 1rem;
  background: var(--panel);
  box-shadow: 0 1.2rem 3rem rgb(0 0 0 / 35%);

  .group+.group {
    margin-top: 0.4rem;
  }

  .group-title {
    margin: 0.4rem 0.7rem;
    color: var(--muted);
    font-size: 1rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    width: 100%;
    padding: 0.7rem 0.9rem;
    border: 0;
    border-radius: 0.6rem;
    background: transparent;
    color: var(--text);
    font-size: 1.2rem;
    text-align: left;
    cursor: pointer;

    &:hover {
      background: var(--panel-2);
    }

    &.active {
      background: var(--accent-soft);
    }

    .option-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .tick {
      flex: none;
      color: var(--accent);
    }
  }

  .empty {
    margin: 1rem 0.7rem;
    color: var(--muted);
    font-size: 1.15rem;
    text-align: center;
  }
}
</style>
