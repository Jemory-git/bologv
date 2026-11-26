<script setup lang="ts">
  /**
   * 侧边栏面板入口：由 PairSlotOutlet 渲染。
   *
   * active / select 是 outlet 注入的控制面（PairEntryControl），
   * 本组件不关心自己对应哪个 pair，只负责展示选中态与上报点击。
   */
  import type { PairEntryControl } from '@ui/slots'

  defineProps<{ label: string } & PairEntryControl>()
</script>

<template>
  <button class="panel-row" :class="{ active }" type="button" :aria-current="active ? 'page' : undefined" @click="select">
    <span class="glyph" aria-hidden="true" />
    <span class="label">{{ label }}</span>
  </button>
</template>

<style scoped lang="scss">
.panel-row {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  width: 100%;
  padding: 0.7rem 1rem;
  border: 0.1rem solid transparent;
  border-radius: 0.8rem;
  background: transparent;
  color: var(--text);
  text-align: left;

  &:hover {
    background: var(--panel-2);
  }

  &.active {
    border-color: var(--accent-line);
    background: var(--accent-soft);
  }

  .glyph {
    width: 1.4rem;
    height: 1.4rem;
    flex: none;
    border-radius: 0.4rem;
    background: var(--line);
  }

  &.active .glyph {
    background: var(--accent);
  }

  .label {
    overflow: hidden;
    font-size: 1.3rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
