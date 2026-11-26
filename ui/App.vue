<script setup lang="ts">
  /**
   * 组合根：组装布局与模态窗，并触发会话恢复。
   *
   * 会话恢复（事件缓冲 + 历史列表 + 初始会话选中）收敛在 useSessionRestore；
   * 会话数据与动作都在 sessions store（侧栏自洽，不经过 App），
   * 这里仅保留两个刷新触发点：会话切换、一轮对话结束。
   */
  import { onMounted, ref, watch } from 'vue'
  import { useChatStore } from '@ui/stores/chat.ts'
  import { useModelsStore } from '@ui/stores/models.ts'
  import { useSessionsStore } from '@ui/stores/sessions.ts'
  import { useSessionRestore } from '@ui/use/session-restore.ts'

  import AppShell from './components/layout/AppShell.vue'
  import Sidebar from './components/layout/Sidebar.vue'
  import StatusBar from './components/layout/StatusBar.vue'
  import StorageAlert from './components/layout/StorageAlert.vue'
  import TitleBar from './components/layout/TitleBar.vue'
  import Modal from './components/modal/Modal.vue'
  import Main from './views/Main.vue'
  import ModelModal from './views/ModelModal.vue'
  import ToolsModal from './views/ToolsModal.vue'

  //states
  const chat = useChatStore()
  const models = useModelsStore()
  const sessions = useSessionsStore()

  type ModalKind = 'model' | 'tools' | null
  const activeModal = ref<ModalKind>(null)

  //hooks
  useSessionRestore()

  onMounted(() => {
    void models.load()
  })
  // 新会话创建（草稿态 → 真实 id）后补进列表；
  // 已存在的会话切换不重复拉取，列表的活跃时间由 pending 结束时的刷新维护。
  watch(
    () => chat.currentSessionId,
    (id) => {
      if (id !== null && !sessions.items.some((item) => item.id === id)) void sessions.load()
    },
  )
  watch(
    () => chat.pending,
    (pending) => {
      if (!pending) void sessions.load()
    },
  )
</script>

<template>
  <AppShell>
    <template #titlebar>
      <TitleBar :model="models.selectedModelId ?? '未配置模型'" />
    </template>
    <template #sidebar>
      <Sidebar @open-model="activeModal = 'model'" @open-tools="activeModal = 'tools'" />
    </template>
    <Main />
    <template #statusbar>
      <StorageAlert />
      <StatusBar />
    </template>
  </AppShell>

  <Modal v-if="activeModal === 'model'" title="配置模型" width="92rem" height="68rem" @close="activeModal = null">
    <ModelModal @close="activeModal = null" />
  </Modal>

  <Modal v-if="activeModal === 'tools'" title="配置工具" width="92rem" height="68rem" @close="activeModal = null">
    <ToolsModal />
  </Modal>
</template>
