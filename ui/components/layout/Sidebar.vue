<script setup lang="ts">
  /**
   * 侧边栏容器：头部、主导航、会话列表、版本号。
   *
   * 会话数据与交互由 SessionList 直接对接 sessions / chat store，
   * 本组件不再承担透传职责。
   */
  import PanelList from '@ui/components/sidebar/PanelList.vue'
  import SessionList from '@ui/components/sidebar/SessionList.vue'
  import SidebarFooter from '@ui/components/sidebar/SidebarFooter.vue'
  import SidebarHeader from '@ui/components/sidebar/SidebarHeader.vue'

  const emit = defineEmits<{
    (e: 'open-model'): void
    (e: 'open-tools'): void
  }>()
</script>

<template>
  <div class="sidebar-content">
    <SidebarHeader />
    <PanelList />
    <SessionList />
    <SidebarFooter @open-model="emit('open-model')" @open-tools="emit('open-tools')" />
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
