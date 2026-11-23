<script setup lang="ts">
  /**
   * 会话列表：唯一滚动区，承载侧边栏的可变内容。
   *
   * 选中态与 sidebarPanels 互斥：
   *   - sidebarPanels.activeId !== null → 插件面板在位 → 所有会话不高亮
   *   - sidebarPanels.activeId === null → ChatView 在位 → 可按需高亮当前会话
   *
   * 列表来自 GET /api/sessions（当前单 session default）。
   * 多会话落地后，把 activeSessionId 接入 chat store 即可。
   */
  import { computed } from 'vue'
  import type { SessionSummary } from '@ui/types/view-model.ts'
  import SessionItem from './SessionItem.vue'
  import { sidebarPanels } from '@ui/slots'

  defineProps<{ sessions: readonly SessionSummary[] }>()

  // 插件面板在位时，session 高亮让位于插件入口
  const panelActive = computed(() => sidebarPanels.activeId.value !== null)
</script>

<template>
  <div class="session-list" role="list" aria-label="会话列表">
    <div class="sidebar-header">
      <div class="row">
        <h2>会话</h2>
        <span class="count">{{ sessions.length }}</span>
      </div>
      <button class="new-chat" type="button" disabled title="多会话将在下一阶段支持">
        ＋ 新建对话
      </button>
    </div>
    <SessionItem v-for="session in sessions" :key="session.id" :session="session" :active="!panelActive" />
  </div>
</template>

<style scoped lang="scss">
.session-list {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.2rem;
  min-height: 0;
  padding: 0.8rem;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--line) transparent;

  .sidebar-header {
    padding: 1.4rem 1.4rem 1rem;
    border-bottom: 0.1rem solid var(--line);

    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.8rem;

      h2 {
        margin: 0;
        color: var(--muted);
        font-size: 1.1rem;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .count {
        padding: 0 0.6rem;
        border-radius: 99.9rem;
        background: var(--panel-2);
        color: var(--muted);
        font: 1.1rem var(--mono);
      }
    }


    .new-chat {
      width: 100%;
      margin-top: 1rem;
      padding: 0.7rem 1rem;
      border: 0.1rem dashed var(--line);
      border-radius: 0.8rem;
      background: transparent;
      color: var(--muted);
      font-size: 1.2rem;
    }
  }
}
</style>
