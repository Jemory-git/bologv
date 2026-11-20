<script setup lang="ts">
  /**
   * 侧边栏容器：头部、主导航、会话列表、版本号。
   *
   * 选中态由 sidebarPanels 统一管理，SessionList 内部消费，
   * 本组件不再透传 activeId。
   */
  import type { SessionSummary } from '@ui/types/view-model.ts'
  import PanelList from '@ui/components/sidebar/PanelList.vue'
  import SessionList from '@ui/components/sidebar/SessionList.vue'
  import SidebarFooter from '@ui/components/sidebar/SidebarFooter.vue'
  import SidebarHeader from '@ui/components/sidebar/SidebarHeader.vue'

  defineProps<{ sessions: readonly SessionSummary[] }>()

const emit = defineEmits<{
  (e: 'open-model'): void
}>()
</script>

<template>
  <div class="sidebar-content">
    <SidebarHeader />
    <PanelList />
    <SessionList :sessions="sessions" />
    <SidebarFooter @open-model="emit('open-model')" />
  </div>
</template>

<style scoped lang="scss">
.sidebar-content {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}
</style>
