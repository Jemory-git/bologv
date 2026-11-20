<script setup lang="ts">
/**
 * 应用外壳：只负责五区网格，不持有任何业务状态。
 */
</script>

<template>
  <div class="app-shell">
    <header class="titlebar"><slot name="titlebar" /></header>
    <aside class="sidebar"><slot name="sidebar" /></aside>
    <main class="main"><slot /></main>
    <footer class="statusbar"><slot name="statusbar" /></footer>
  </div>
</template>

<style scoped lang="scss">
.app-shell {
  display: grid;
  grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
  grid-template-rows: var(--titlebar-height) minmax(0, 1fr) var(--statusbar-height);
  grid-template-areas:
    'titlebar titlebar'
    'sidebar main'
    'statusbar statusbar';
  height: 100vh;
  overflow: hidden;
  background: var(--bg);
}

.titlebar {
  grid-area: titlebar;
  display: flex;
  min-width: 0;
  border-bottom: 0.1rem solid var(--line);
  background: var(--panel);
}

.sidebar {
  grid-area: sidebar;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  border-right: 0.1rem solid var(--line);
  background: var(--panel);
}

.main {
  grid-area: main;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.statusbar {
  grid-area: statusbar;
  display: flex;
  min-width: 0;
  border-top: 0.1rem solid var(--line);
  background: var(--panel);
}
</style>
