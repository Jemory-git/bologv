import type { Context } from './context.ts'

export type Disposer = () => void
export type Listener = (payload: unknown) => void

/** 对象插件：显式声明 name / inject，apply 承担实际逻辑。 */
export interface PluginObject {
  /** 插件名，同时作为它自己的作用域名。 */
  name: string
  /** 需要等待的服务名；服务先提供还是先声明都无所谓。 */
  inject?: string[]
  /** 依赖就绪后在子作用域里执行；函数返回即视为加载完成。 */
  apply(ctx: Context, config?: Record<string, unknown>): void | Promise<void>
}

/**
 * 函数插件：函数本身即 apply，元数据（inject）挂在函数属性上。
 *
 * 注意：工厂（返回 Plugin 的函数）不是这个形态，必须在清单里先调用，
 * 把返回值交给 use()。直接传工厂会被当作 apply 调用，返回值被忽略。
 */
export interface PluginFunction {
  (ctx: Context, config?: Record<string, unknown>): void | Promise<void>
  /** 需要等待的服务名。 */
  inject?: string[]
}

export type Plugin = PluginObject | PluginFunction
