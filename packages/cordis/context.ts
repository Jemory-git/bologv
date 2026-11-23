/**
 * Context —— 作用域：服务访问 + 事件总线 + 副作用栈。
 *
 * 根 context 通过 createRoot() 创建；子 context 通过 ctx.child(name) 创建。
 * 子 context 共享服务表和事件总线，但拥有独立的 Scope（副作用栈）——
 * 这就是 cordis 的 Fiber 语义：每个插件在自己的 Scope 里注册 effect，
 * 卸载时逆序回收。
 *
 * 设计约束（来自原项目 vendor/cordis）：
 * 1. 内核不含任何业务代码，能力全部由插件提供。
 * 2. 注册即效果：provide / on / effect 都返回 disposer，卸载时逆序回收。
 * 3. 依赖解析是「等待服务可用」，与插件加载顺序无关。
 */

import type { Disposer, Listener, Plugin } from './types.ts'
import { EventBus } from './events.ts'
import { Scope } from './scope.ts'
import { ServiceContainer } from './services.ts'

/** 全局共享标记：根 context close() 后，所有 use() 都会抛错。 */
interface DisposedRef {
  current: boolean
}

export function createRoot(): Context {
  const disposed: DisposedRef = { current: false }
  const services = new ServiceContainer()
  const events = new EventBus()
  return new Context(services, events, disposed, 'root')
}

export class Context {
  /** 服务容器：全局共享，所有 Context 共用同一张表。 */
  readonly services: ServiceContainer
  /** 事件总线：全局共享。 */
  readonly events: EventBus
  /** 本作用域的副作用栈；每个 Context（包括子 context）独立拥有。 */
  readonly scope: Scope
  /** 作用域名；根为 'root'，子 context 取 plugin.name。 */
  readonly name: string

  /** 指向根 context 的 disposed 标记；全部 context 共享。 */
  readonly #disposed: DisposedRef

  /** 本 context 在父作用域栈里的登记条目；dispose() 时精确摘除。 */
  #parentScope: Scope | undefined
  #parentEntry: Disposer | undefined

  constructor(
    services: ServiceContainer,
    events: EventBus,
    disposed: DisposedRef,
    name: string,
  ) {
    this.services = services
    this.events = events
    this.scope = new Scope()
    this.name = name
    this.#disposed = disposed
  }

  // -- 服务容器委托 ---------------------------------------------------------

  get<T>(name: string): T | undefined {
    return this.services.get<T>(name)
  }

  require<T>(name: string): T {
    return this.services.require<T>(name)
  }

  /**
   * 提供一项能力；同名重复提供直接报错，避免静默覆盖。
   * 返回 disposer 同时登记到本作用域的 Scope 栈里，卸载时自动回收。
   */
  provide<T>(name: string, value: T): Disposer {
    const disposer = this.services.provide<T>(name, value)
    return this.scope.effect(disposer)
  }

  async wait(names: string[]): Promise<void> {
    return this.services.wait(names)
  }

  // -- 事件总线委托 ---------------------------------------------------------

  /** 注册监听器；返回 disposer，同时登记进 Scope 栈。 */
  on(event: string, listener: Listener): Disposer {
    const disposer = this.events.on(event, listener)
    return this.scope.effect(disposer)
  }

  emit(event: string, payload?: unknown): void {
    this.events.emit(event, payload)
  }

  // -- Scope 委托 -----------------------------------------------------------

  /** 登记一个清理动作；这是「注册即效果」的统一入口。 */
  effect(disposer: Disposer): Disposer {
    return this.scope.effect(disposer)
  }

  /** 本作用域是否已卸载（根 context 除外——根 scope 只在 close() 后 disposed）。 */
  get isDisposed(): boolean {
    return this.scope.isDisposed
  }

  /** 逆序回收本作用域的全部贡献，并从父作用域摘除自身登记。幂等。 */
  dispose(): void {
    try {
      this.scope.dispose()
    } finally {
      // 回收抛错也要摘除，避免父栈残留指向已卸载 scope 的死闭包。
      if (this.#parentScope !== undefined && this.#parentEntry !== undefined) {
        this.#parentScope.remove(this.#parentEntry)
        this.#parentScope = undefined
        this.#parentEntry = undefined
      }
    }
  }

  // -- 子作用域 + 插件加载 --------------------------------------------------

  /** 创建子作用域：共享 services + events，但独立 Scope。 */
  child(name: string): Context {
    return new Context(this.services, this.events, this.#disposed, name)
  }

  /** 使用插件：等依赖 → 子作用域 apply → 记录回收。对象插件与函数插件都支持。 */
  async use(plugin: Plugin, config?: Record<string, unknown>): Promise<Context> {
    if (this.#disposed.current) throw new Error('context is disposed')
    const { name, inject, apply } = normalizePlugin(plugin)
    const scope = this.child(name)
    await scope.wait(inject)
    if (this.#disposed.current) throw new Error('context is disposed')
    this.emit('plugin/start', name)
    try {
      await apply(scope, config)
    } catch (error) {
      // apply 中途失败：立即回收子 scope 已注册的贡献，避免服务/监听残留全局表。
      try {
        scope.dispose()
      } catch (disposeError) {
        console.error(`[cordis] disposing failed plugin "${name}" threw:`, disposeError)
      }
      throw error
    }
    // 父栈登记子 scope 的回收条目，并让子 scope 持有摘除柄：
    // 子 scope 被独立 dispose()（如插件禁用）时从父栈精确移除，不累积死闭包。
    const entry: Disposer = () => scope.dispose()
    this.scope.effect(entry)
    scope.#parentScope = this.scope
    scope.#parentEntry = entry
    this.emit('plugin/ready', name)
    return scope
  }

  /** 关闭整个应用：标记 disposed → reject 挂起的 waiter → 回收根 scope 的全部贡献。 */
  close(): void {
    this.#disposed.current = true
    // 解除所有挂起的 wait()，让卡住的 use() 抛错而非永久挂起。
    this.services.rejectAllWaiters('context is disposed')
    this.dispose()
  }
}

/** 统一的插件元数据形态。 */
interface NormalizedPlugin {
  name: string
  inject: string[]
  apply(ctx: Context, config?: Record<string, unknown>): void | Promise<void>
}

/** 对象插件与函数插件归一化：函数插件用函数名作作用域名，inject 挂在函数属性上。 */
function normalizePlugin(plugin: Plugin): NormalizedPlugin {
  if (typeof plugin === 'function') {
    return {
      name: plugin.name || '<anonymous>',
      inject: plugin.inject ?? [],
      apply: plugin,
    }
  }
  return {
    name: plugin.name,
    inject: plugin.inject ?? [],
    apply: (ctx, config) => plugin.apply(ctx, config),
  }
}
