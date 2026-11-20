import type { Context } from './context.ts'

export type Disposer = () => void
export type Listener = (payload: unknown) => void

export interface Plugin {
  /** 插件名，同时作为它自己的作用域名。 */
  name: string
  /** 需要等待的服务名；服务先提供还是先声明都无所谓。 */
  inject?: string[]
  /** 依赖就绪后在子作用域里执行；函数返回即视为加载完成。 */
  apply(ctx: Context, config?: Record<string, unknown>): void | Promise<void>
}
