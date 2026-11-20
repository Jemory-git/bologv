<script setup lang="ts">
/**
 * 组合根：把插件状态接到布局组件上。
 * App.vue 本身不持有业务状态，只负责组装 slot 和模态窗。
 * 会话列表来自 GET /api/sessions，一轮对话结束后刷新摘要。
 * 模型配置在此初始加载进 models store；ModelModal 保存后刷新 store。
 */
import { onMounted, ref, watch } from 'vue'
import { getSessions } from '@ui/http'
import { useChatStore } from '@ui/stores/chat.ts'
import { useModelsStore } from '@ui/stores/models.ts'

import AppShell from './components/layout/AppShell.vue'
import Sidebar from './components/layout/Sidebar.vue'
import StatusBar from './components/layout/StatusBar.vue'
import StorageAlert from './components/layout/StorageAlert.vue'
import TitleBar from './components/layout/TitleBar.vue'
import Modal from './components/modal/Modal.vue'
import Main from './views/Main.vue'
import ModelModal from './views/ModelModal.vue'

import type { SessionSummary } from './types/view-model.ts'

//states
const chat = useChatStore()
const models = useModelsStore()

type ModalKind = 'model' | null
const activeModal = ref<ModalKind>(null)
const sessions = ref<SessionSummary[]>([])

//methods
async function loadSessions(): Promise<void> {
  const [err, body] = await getSessions()
  if (err || body.code !== 0) return // 侧边栏非关键路径，失败静默
  sessions.value = (body.data ?? []).map((s) => ({
    id: s.id,
    title: s.preview || '当前会话',
    subtitle: s.lastActive > 0 ? formatActive(s.lastActive) : '',
  }))
}

function formatActive(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

//hooks
onMounted(() => {
  void loadSessions()
  void models.load()
})
watch(
  () => chat.pending,
  (pending) => {
    if (!pending) void loadSessions() // 一轮结束刷新摘要
  },
)
</script>

<template>
  <AppShell>
    <template #titlebar>
      <TitleBar :model="models.selectedModelId ?? '未配置模型'" :pending="chat.pending" />
    </template>
    <template #sidebar>
      <Sidebar :sessions="sessions" @open-model="activeModal = 'model'" />
    </template>
    <Main />
    <template #statusbar>
      <StorageAlert />
      <StatusBar />
    </template>
  </AppShell>

  <Modal v-if="activeModal === 'model'" title="配置模型" width="92rem" height="68rem" @close="activeModal = null">
    <ModelModal />
  </Modal>
</template>
