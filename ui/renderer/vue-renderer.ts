/**
 * vue-renderer 插件：唯一负责创建 Vue 应用、provide Cordis Context、挂载根组件。
 *
 * 插槽现在是 @ui/slots/ 下的模块级单例，
 * 插件和组件直接 import 即可，不需要通过 Registry 注入。
 *
 * 挂载动作由 main.ts 在所有 Cordis 插件装好之后调用，保证首帧就能看到全部插槽贡献。
 */

import type { App as VueApp } from 'vue'
import type { Plugin as CordisPlugin } from '@pkg/cordis'
import { createApp } from 'vue'
import RootApp from '@ui/App.vue'
import { CONTEXT_SERVICE } from '@ui/use'

/** 渲染器服务的 Cordis 服务名。 */
export const RENDERER_SERVICE = 'renderer'

/** 供宿主在插件装配完成后触发的挂载入口。 */
export interface RendererService {
  /**
   * 把根组件挂到 #app；重复调用直接报错。
   *
   * @param setup 在 provide + mount 之前对 Vue app 做额外安装（如 app.use(pinia)）。
   */
  mount(setup?: (app: VueApp) => void): void
}

export const vueRenderer: CordisPlugin = {
  name: 'vue-renderer',
  apply(ctx) {
    let mounted = false
    const renderer: RendererService = {
      mount(setup) {
        if (mounted) throw new Error('vue-renderer 已经挂载过')
        mounted = true
        const app = createApp(RootApp)
        setup?.(app)
        // 组件通过这个作用域取用其他插件提供的状态服务。
        app.provide(CONTEXT_SERVICE, ctx)
        app.mount('#app')
        ctx.effect(() => app.unmount())
      },
    }
    ctx.provide(RENDERER_SERVICE, renderer)
  },
}
