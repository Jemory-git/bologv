<script setup lang="ts">
/**
 * 外置插件视图宿主：把插槽的 Vue 渲染与插件的面板内容隔开。
 *
 * 内容有两种来源：
 *   props.component —— 插件提供的 Vue 组件，直接用宿主运行时渲染；
 *   props.mount     —— 插件操作容器 DOM；返回的清理函数在卸载时调用。
 * 因此停用插件时既回收插槽注册，也会执行插件自己的清理逻辑。
 *
 * 容器只做一件事：用 grid 把宿主给它的格子整个交给插件。
 * 唯一直接子元素（组件或 mount 容器）作为 grid item 默认 stretch 占满区域，
 * 因此不需要按插槽场景区分形态，插件也不必再写 width/height 100%。
 * 留白、滚动、颜色、字号一律交给父容器或插件自己（组件样式 / injectStyle）。
 *
 * 配套约定：放外置条目的宿主容器用 grid 给每个条目一个格子（见 StatusBar），
 * 否则在 flex 行里 width:100% 会按整行计算，挤掉相邻条目。
 */
import type { ExternalViewHostProps } from '@ui/plugins/core/types.ts'
import { onBeforeUnmount, onMounted, ref } from 'vue'

//states
const props = defineProps<ExternalViewHostProps>()

const container = ref<HTMLElement | null>(null)
let cleanup: (() => void) | undefined

//hooks
onMounted(() => {
  if (props.mount === undefined || container.value === null) return
  cleanup = props.mount(container.value) ?? undefined
})

onBeforeUnmount(() => {
  cleanup?.()
  cleanup = undefined
})
</script>

<template>
  <div class="external-view">
    <component :is="component" v-if="component !== undefined" />
    <div v-else ref="container" class="external-dom" />
  </div>
</template>

<style scoped lang="scss">
.external-view {
  display: grid;
  // 唯一的格子严格等于容器尺寸，插件内容再高也撑不破，滚动由插件自己处理。
  grid-template: minmax(0, 1fr) / minmax(0, 1fr);
  width: 100%;
  height: 100%;
  // 在 flex / grid 父级里允许被压缩，不撑破布局。
  min-width: 0;
  min-height: 0;
}
</style>
