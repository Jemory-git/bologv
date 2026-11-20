/**
 * 把渲染进程的 Cordis 作用域交给 Vue 组件树。
 * 组件按服务名取用状态，不直接依赖某个具体插件模块。
 */

import { inject } from 'vue'
import type { InjectionKey } from 'vue'
import type { Context } from '@pkg/cordis'

/** 组件树里注入 Cordis 作用域的 key。 */
export const CONTEXT_SERVICE: InjectionKey<Context> = Symbol('bologui-context')

/**
 * 取用一项已提供的服务。
 *
 * @param name 服务名，与插件 provide 时使用的名字一致。
 * @returns 服务实例；缺失时直接报错，避免组件静默渲染空状态。
 */
export function useService<T>(name: string): T {
  const ctx = inject(CONTEXT_SERVICE)
  if (ctx === undefined) throw new Error('Cordis 上下文未提供：请确认应用由 vue-renderer 挂载')
  return ctx.require<T>(name)
}
