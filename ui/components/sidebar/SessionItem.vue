<script setup lang="ts">
  /**
   * 单条会话：点击时切回默认视图（选中 sidebar.panels 的 null）。
   * 直接拿 PairSlot，不需要经过 Registry。
   */
  import type { SessionSummary } from '@ui/types/view-model.ts'
  import { sidebarPanels } from '@ui/slots'

  defineProps<{ session: SessionSummary; active: boolean }>()
</script>

<template>
  <button class="session-item" :class="{ active }" type="button" role="listitem" @click="sidebarPanels.select(null)">
    <span class="mark" aria-hidden="true" />
    <span class="body">
      <span class="title">{{ session.title }}</span>
      <span v-if="session.subtitle" class="subtitle">{{ session.subtitle }}</span>
    </span>
  </button>
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
}

.session-item:hover {
  background: var(--panel-2);
}

.session-item.active {
  border-color: var(--accent-line);
  background: var(--accent-soft);
}

.mark {
  width: 0.7rem;
  height: 0.7rem;
  flex: none;
  border-radius: 99.9rem;
  background: var(--muted);
}

.session-item.active .mark {
  background: var(--accent);
}

.body {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.title {
  overflow: hidden;
  font-size: 1.3rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subtitle {
  overflow: hidden;
  color: var(--muted);
  font: 1.1rem var(--mono);
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
