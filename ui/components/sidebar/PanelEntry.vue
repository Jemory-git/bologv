<script setup lang="ts">
  /**
   * 侧边栏面板入口：由 PairSlot ListSlotOutlet 渲染，
   * active / select 是 ListSlotOutlet 自动注入的 pair 专属 props。
   *
   * 本组件对 slots 体系完全不知情——它只是声明自己需要这两个 props，
   * 真正的选中态维护由 SlotRegistry 负责。
   */

  defineProps<{
    label: string
    /** ListSlotOutlet 自动注入：当前 pair 是否被选中 */
    active: boolean
  }>()

  const emit = defineEmits(['select'])
</script>

<template>
  <button class="panel-row" :class="{ active }" type="button" :aria-current="active ? 'page' : undefined" @click="emit('select')">
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
