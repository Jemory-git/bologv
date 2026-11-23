<script setup lang="ts">
  /**
   * 主区域：消费 sidebar.panels 配对插槽的 active view。
   *
   * 从 PairSlot.active 直接拿到当前选中的 view，
   * null 表示回到会话页（ChatView，自包含状态）。
   */
  import ChatView from '@ui/views/ChatView.vue'
  import { sidebarPanels } from '@ui/slots'

  const activePair = sidebarPanels.active
</script>

<template>
  <ChatView v-if="activePair === null" />
  <component v-else :is="activePair.view.component" :key="activePair.id" v-bind="activePair.view.props()" />
</template>
