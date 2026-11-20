/**
 * Scope —— 单个作用域的副作用栈。
 *
 * 对应官方 cordis 的 Fiber（简化版）：每个插件实例在自己的 Scope 里
 * 注册 effect，卸载时逆序回收。Context.child() 会给每个子 context
 * 创建一个全新的 Scope 实例，共享父 context 的 services / events。
 */

import type { Disposer } from './types.ts'

export class Scope {
  /** 登记的清理动作；逆序执行。 */
  #disposers: Disposer[] = []
  /** 是否已卸载；dispose() 后为 true，再调是幂等 no-op。 */
  #isDisposed = false

  get isDisposed(): boolean {
    return this.#isDisposed
  }

  /** 登记一个清理动作；同时返回它，便于手动卸载。 */
  effect(disposer: Disposer): Disposer {
    if (this.#isDisposed) disposer()
    else this.#disposers.push(disposer)
    return disposer
  }

  /** 摘除一个已登记的清理动作（不执行它）；不存在则 no-op。 */
  remove(disposer: Disposer): void {
    const index = this.#disposers.indexOf(disposer)
    if (index !== -1) this.#disposers.splice(index, 1)
  }

  /**
   * 逆序回收全部副作用。幂等——官方 cordis Fiber.dispose() 保证：
   * 第一次真卸载，再调是 no-op 不抛错。UI 启停按钮可能被重复点。
   */
  dispose(): void {
    if (this.#isDisposed) return
    this.#isDisposed = true
    const disposers = this.#disposers.reverse()
    this.#disposers = []
    const errors: unknown[] = []
    for (const disposer of disposers) {
      try {
        disposer()
      } catch (error) {
        errors.push(error)
      }
    }
    // 保证全部 disposer 都跑完；失败聚合抛出，让调用方知道回收有异常。
    if (errors.length > 0) {
      throw new AggregateError(errors, 'scope dispose: one or more disposers failed')
    }
  }
}
