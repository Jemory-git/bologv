<script setup lang="ts">
/**
 * 会话列表：唯一滚动区，会话功能的交互入口。
 *
 * - 列表数据与增删改动作来自 sessions store，组件不直接发请求
 * - 搜索框仅在前端按标题过滤，不改后端查询
 * - 插件面板在位时（sidebarPanels.activeId !== null），会话列表整体不高亮
 * - 「…」按钮（hover 时显示）打开操作菜单；再次点击同一按钮收起
 * - 删除在菜单内二次确认；删除当前会话后由 store 负责回退
 */
import { computed, ref } from 'vue'
import SessionItem from './SessionItem.vue'
import SessionMenu from './SessionMenu.vue'
import { useChatStore } from '@ui/stores/chat.ts'
import { useSessionsStore } from '@ui/stores/sessions.ts'
import { sidebarPanels } from '@ui/slots'

//states
const chat = useChatStore()
const sessions = useSessionsStore()
const query = ref('')
const menu = ref<{ id: string; x: number; y: number } | null>(null)
const editingId = ref<string | null>(null)

//computed
const panelActive = computed(() => sidebarPanels.activeId.value !== null)
const filtered = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  if (keyword === '') return sessions.items
  return sessions.items.filter((item) => item.title.toLowerCase().includes(keyword))
})

//methods
function isActive(sessionId: string): boolean {
  if (panelActive.value) return false
  return sessionId === chat.currentSessionId
}

function onclickMore(id: string, x: number, y: number): void {
  editingId.value = null
  // 同一个「…」再点一次 = 收起
  if (menu.value?.id === id) {
    menu.value = null
    return
  }
  menu.value = { id, x, y }
}

function startRename(): void {
  if (menu.value === null) return
  editingId.value = menu.value.id
  menu.value = null
}

async function onRename(id: string, title: string): Promise<void> {
  editingId.value = null
  await sessions.rename(id, title)
}

async function removeFromMenu(): Promise<void> {
  const target = menu.value
  menu.value = null
  if (target !== null) await sessions.remove(target.id)
}
</script>

<template>
  <div class="session-list" role="list" aria-label="会话列表">
    <div class="sidebar-header">
      <div class="row">
        <h2>会话</h2>
        <span class="count">{{ filtered.length }}</span>
      </div>
      <input v-model="query" class="search" type="search" placeholder="搜索会话" aria-label="搜索会话" />
      <button class="new-chat" type="button" @click="sessions.startNew()">
        ＋ 新建对话
      </button>
    </div>
    <p v-if="sessions.error !== null" class="error">{{ sessions.error }}</p>
    <SessionItem v-for="session in filtered" :key="session.id" :session="session" :active="isActive(session.id)"
      :editing="editingId === session.id" :menu-open="menu !== null && menu.id === session.id"
      @select="sessions.select($event)" @click-more="onclickMore" @rename="onRename"
      @cancel-rename="editingId = null" />
    <p v-if="filtered.length === 0" class="empty">
      {{ sessions.loading ? '加载中…' : query.trim() === '' ? '还没有会话' : '没有匹配的会话' }}
    </p>
    <SessionMenu v-if="menu !== null" :x="menu.x" :y="menu.y" @rename="startRename" @delete="removeFromMenu"
      @close="menu = null" />
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

    .search {
      width: 100%;
      margin-top: 1rem;
      padding: 0.6rem 0.9rem;
      border: 0.1rem solid var(--line);
      border-radius: 0.7rem;
      background: var(--panel-2);
      color: var(--text);
      font-size: 1.2rem;

      &::placeholder {
        color: var(--muted);
      }

      &:focus {
        outline: none;
        border-color: var(--accent-line);
      }

      &::-webkit-search-cancel-button {
        cursor: pointer;
      }
    }

    .new-chat {
      width: 100%;
      margin-top: 0.6rem;
      padding: 0.7rem 1rem;
      border: 0.1rem dashed var(--line);
      border-radius: 0.8rem;
      background: transparent;
      color: var(--muted);
      font-size: 1.2rem;
      cursor: pointer;
      transition: border-color 0.15s ease, color 0.15s ease;

      &:hover {
        border-color: var(--accent);
        color: var(--accent);
      }

      &:active {
        transform: scale(0.98);
      }
    }
  }

  .empty {
    margin: 1.2rem 0.8rem;
    color: var(--muted);
    font-size: 1.2rem;
    text-align: center;
  }

  .error {
    margin: 0.8rem;
    padding: 0.6rem 0.8rem;
    border: 0.1rem solid var(--fail);
    border-radius: 0.6rem;
    color: var(--fail);
    font-size: 1.1rem;
  }
}
</style>
