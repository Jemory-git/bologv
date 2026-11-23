<script setup lang="ts">
  /**
   * 底部状态栏：只负责容器布局，所有具体条目由 ListSlot "statusbar.items" 的插件注册。
   */
  import ListSlotOutlet from '@ui/components/slots/ListSlotOutlet.vue'
  import { statusbarItems } from '@ui/slots'
</script>

<template>
  <div class="statusbar-content">
    <ListSlotOutlet :slot="statusbarItems" reverse />
  </div>
</template>

<style scoped lang="scss">
.statusbar-content {
  display: grid;
  // 每个条目一个格子，列宽由内容决定：外置容器（ExternalViewHost）才能安全地
  // width/height 100%，不会像在 flex 行里那样占满整行、挤掉相邻条目。
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, auto);
  justify-content: end;
  // 行高由内容决定并整体垂直居中，条目文本不会被拉伸到整条状态栏高度。
  align-content: center;
  align-items: center;
  gap: 0.8rem;
  flex: 1;
  padding: 0 1.2rem;
  overflow: hidden;
  color: var(--muted);
  font: 1.1rem var(--mono);
  white-space: nowrap;
}
</style>
