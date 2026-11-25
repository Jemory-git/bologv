<script setup lang="ts">
import IconReload from '~icons/icon-park-outline/refresh'

// events
function onClick(): void {
  window.location.reload()
}
</script>

<template>
  <button class="reload-button" type="button" title="重新加载界面" aria-label="重新加载界面" @click="onClick">
    <IconReload :size="15" />
  </button>
</template>

<style scoped lang="scss">
.reload-button {
  display: grid;
  place-items: center;
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 0.4rem;
  color: var(--muted);
  transition: background-color 0.15s ease, color 0.15s ease;

  &:hover {
    background: var(--accent-soft);
    color: var(--accent);
  }

  &:focus-visible {
    outline: 0.1rem solid var(--accent-line);
    outline-offset: 0.1rem;
  }
}
</style>
