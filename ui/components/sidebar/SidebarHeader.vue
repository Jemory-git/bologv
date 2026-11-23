<script setup lang="ts">
  /**
   * 侧边栏头部：品牌标识。
   */
</script>

<template>
  <div class="sidebar-header">
    <div class="brand">
      <span class="name">Bologv</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.sidebar-header {
  display: flex;
  align-items: center;
  padding: 1.4rem;

  .brand {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    font-weight: 650;

    .name {
      font-size: 1.4rem;
    }
  }
}
</style>
