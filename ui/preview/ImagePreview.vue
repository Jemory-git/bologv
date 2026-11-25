<script setup lang="ts">
  /** 图片预览：只做「适应窗口」，不提供缩放与拖拽。 */
  defineProps<{ src: string }>()
</script>

<template>
  <figure class="stage">
    <img class="image" :src="src" alt="" />
  </figure>
</template>

<style scoped lang="scss">
.stage {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  margin: 0;
}

.image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
</style>
