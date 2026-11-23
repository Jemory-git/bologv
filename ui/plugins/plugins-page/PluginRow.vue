<script setup lang="ts">
  /**
   * 插件行：内置与外置共用。
   * 只负责展示，把操作抛给父级；启用状态与错误均来自 registry。
   */
  import type { UiPluginMeta } from '@ui/plugins/core/types.ts'
  import { computed } from 'vue'

  //states
  const props = defineProps<{
    meta: UiPluginMeta
    enabled: boolean
    busy: boolean
    error?: string
  }>()
  console.log(props.meta);

  const isFixed = computed(() => props.meta.origin === 'builtin' && props.meta.fixed)
  const version = computed(() => (props.meta.origin === 'external' ? props.meta.version : undefined))

  //events
  const emit = defineEmits<{
    toggle: []
    reload: []
  }>()
</script>

<template>
  <li class="plugin-item" :class="{ weak: isFixed }">
    <span class="status" :class="{ on: enabled }" :title="enabled ? '已启用' : '已停用'" />

    <div class="plugin-info">
      <div class="plugin-label">
        {{ meta.label }}
        <span v-if="meta.origin === 'external'" class="tag tag-external">外置</span>
        <span v-if="version" class="tag tag-version">v{{ version }}</span>
      </div>
      <div v-if="meta.description" class="plugin-desc">{{ meta.description }}</div>
      <div class="plugin-id">{{ meta.id }}</div>
      <div v-if="error" class="plugin-error">{{ error }}</div>
    </div>

    <div class="plugin-actions">
      <button v-if="meta.origin === 'external'" type="button" class="ghost" :disabled="busy || !enabled" @click="emit('reload')">重载</button>
      <button v-if="!isFixed" type="button" class="switch" role="switch" :aria-checked="enabled" :disabled="busy" :title="enabled ? '停用插件' : '启用插件'" @click="emit('toggle')">
        <span class="knob" />
      </button>
    </div>
  </li>
</template>

<style scoped lang="scss">
.plugin-item {
  position: relative;
  display: grid;
  grid-template-columns: 0.8rem 1fr auto;
  gap: 1.4rem;
  align-items: center;
  padding: 1.4rem 1.8rem;
  transition: background 0.15s;

  &::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 0.2rem;
    background: var(--accent);
    opacity: 0;
    transition: opacity 0.15s;
  }

  &:hover {
    background: var(--panel-2);

    &::before {
      opacity: 1;
    }
  }

  &+& {
    border-top: 0.1rem solid var(--line);
  }

  .status {
    width: 0.7rem;
    height: 0.7rem;
    border: 0.1rem solid var(--line);
    border-radius: 50%;
    transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;

    &.on {
      border-color: var(--ok);
      background: var(--ok);
      box-shadow: 0 0 0.8rem rgba(89, 201, 141, 0.45);
    }
  }

  .plugin-info {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    min-width: 0;
  }

  .plugin-label {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    align-items: center;
    font-size: 1.4rem;
    font-weight: 600;

    .tag {
      padding: 0.1rem 0.5rem;
      border: 0.1rem solid var(--line);
      border-radius: 0.3rem;
      color: var(--muted);
      font: 1rem var(--mono);
    }

    .tag-external {
      border-color: var(--accent-line);
      color: var(--accent);
    }

    .tag-version {
      border-color: transparent;
      background: var(--accent-soft);
      color: var(--accent);
    }
  }

  .plugin-desc {
    color: var(--muted);
    font-size: 1.2rem;
  }

  .plugin-id {
    color: var(--muted);
    font: 1rem var(--mono);
    letter-spacing: 0.04em;
  }

  .plugin-error {
    color: var(--fail);
    font-size: 1.2rem;
  }

  .plugin-actions {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 1rem;
  }

  .ghost {
    padding: 0.3rem 0.9rem;
    border: 0.1rem solid var(--line);
    border-radius: 0.4rem;
    background: transparent;
    color: var(--muted);
    font: 1.1rem var(--mono);
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s, opacity 0.15s;

    &:hover:not(:disabled) {
      border-color: var(--accent-line);
      color: var(--accent);
    }

    &:disabled {
      opacity: 0.4;
      cursor: default;
    }
  }

  .switch {
    position: relative;
    width: 3.4rem;
    height: 1.9rem;
    padding: 0;
    border: 0.1rem solid var(--line);
    border-radius: 99rem;
    background: var(--panel-2);
    cursor: pointer;
    transition: background 0.18s, border-color 0.18s;

    .knob {
      position: absolute;
      top: 50%;
      left: 0.25rem;
      width: 1.3rem;
      height: 1.3rem;
      border-radius: 50%;
      background: var(--muted);
      transform: translateY(-50%);
      transition: left 0.18s ease, background 0.18s;
    }

    &[aria-checked='true'] {
      border-color: var(--accent-line);
      background: var(--accent-soft);

      .knob {
        left: calc(100% - 1.55rem);
        background: var(--accent);
        box-shadow: 0 0 0.8rem var(--accent-line);
      }
    }

    &:disabled {
      opacity: 0.45;
      cursor: default;
    }
  }
}

.weak {
  opacity: 0.6;
}
</style>
