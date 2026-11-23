/**
 * 注入给外置插件的 Vue 运行时白名单。
 *
 * 为什么必须注入而不是让插件自己 import：
 *   1. 外置插件是浏览器直接加载的单文件 ESM，裸说明符 'vue' 无法解析；
 *   2. 即使能解析到，第二份 Vue 运行时会让响应式系统分裂（ref 跨实例失效）。
 *
 * 因此宿主把自己这份 Vue 的常用 API 挑出来交给插件，权限面比整包转发更小。
 * 新增导出只需在这里加一行，ExternalVueApi 类型会自动跟随。
 */

import {
  Fragment,
  computed,
  defineComponent,
  h,
  isRef,
  markRaw,
  nextTick,
  onBeforeUnmount,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  shallowReactive,
  shallowRef,
  toRef,
  toRefs,
  unref,
  watch,
  watchEffect,
} from 'vue'

export const externalVueApi = {
  Fragment,
  computed,
  defineComponent,
  h,
  isRef,
  markRaw,
  nextTick,
  onBeforeUnmount,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  shallowReactive,
  shallowRef,
  toRef,
  toRefs,
  unref,
  watch,
  watchEffect,
} as const

/** 外置插件拿到的 Vue API 形状。 */
export type ExternalVueApi = typeof externalVueApi
