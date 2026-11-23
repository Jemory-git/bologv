<script setup lang="ts">

const version = '0.0.1'
</script>

<template>
  <span class="item" :title="`bologv v${version}`">v{{ version }}</span>
</template>

<style scoped>
.item {
  font-weight: 600;
}
</style>
