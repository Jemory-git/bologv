/**
 * ServiceContainer —— 服务容器：provide / get / require / wait。
 *
 * 全局共享，所有 Context 共用同一张 services 表和 waiters 表。
 * provide() 返回的 disposer 只负责从表里删掉；由调用方（Context）
 * 再用 Scope.effect() 登记到自己的栈里，实现卸载时逆序回收。
 *
 * wait() 带超时：依赖永不就绪时 reject 并点名缺失服务，而不是永久挂起。
 * close() 经 rejectAllWaiters() 解除所有挂起的等待。
 */

import type { Disposer } from './types.ts'

/** 一个等待某服务就绪的 waiter：resolve/reject + 超时定时器。 */
interface Waiter {
  resolve: () => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

/** 依赖等待的默认超时；超时即 reject，避免 inject 写错时 boot 静默挂死。 */
const DEFAULT_WAIT_TIMEOUT_MS = 30_000

export class ServiceContainer {
  /** 服务名 → 实例；全局共享。 */
  readonly #services: Map<string, unknown>
  /** 等某个服务就绪的 waiter 集合；provide() 成功后自动解掉。 */
  readonly #waiters: Map<string, Set<Waiter>>
  readonly #waitTimeoutMs: number

  constructor(
    services?: Map<string, unknown>,
    waiters?: Map<string, Set<Waiter>>,
    waitTimeoutMs: number = DEFAULT_WAIT_TIMEOUT_MS,
  ) {
    this.#services = services ?? new Map()
    this.#waiters = waiters ?? new Map()
    this.#waitTimeoutMs = waitTimeoutMs
  }

  get<T>(name: string): T | undefined {
    return this.#services.get(name) as T | undefined
  }

  require<T>(name: string): T {
    const value = this.get<T>(name)
    if (value === undefined) throw new Error(`service "${name}" is not available`)
    return value
  }

  /** 提供一项能力；同名重复提供直接报错，避免静默覆盖。 */
  provide<T>(name: string, value: T): Disposer {
    if (this.#services.has(name)) throw new Error(`service "${name}" already provided`)
    this.#services.set(name, value)
    this.#flushWaiters(name)
    return () => {
      // 身份守卫：只删本次提供的值，避免误删同名重新 provide 的后来者。
      if (this.#services.get(name) === value) this.#services.delete(name)
    }
  }

  /** 等待这些服务全部可用；服务先提供还是先声明都无所谓。超时即 reject。 */
  async wait(names: string[]): Promise<void> {
    const missing = names.filter((name) => !this.#services.has(name))
    if (missing.length === 0) return
    const entries: Array<{ name: string; waiter: Waiter }> = []
    const promises = missing.map(
      (name) =>
        new Promise<void>((resolve, reject) => {
          const waiter: Waiter = {
            resolve,
            reject,
            timer: setTimeout(() => {
              this.#removeWaiter(name, waiter)
              reject(new Error(`timeout waiting for service "${name}" (${this.#waitTimeoutMs}ms)`))
            }, this.#waitTimeoutMs),
          }
          const list = this.#waiters.get(name) ?? new Set<Waiter>()
          list.add(waiter)
          this.#waiters.set(name, list)
          entries.push({ name, waiter })
        }),
    )
    try {
      await Promise.all(promises)
    } finally {
      // 无论成败都清理本次注册的 waiter：清定时器、移出表，
      // 避免 Promise.all 提前结算后其余 waiter 泄漏。
      for (const { name, waiter } of entries) this.#removeWaiter(name, waiter)
    }
  }

  /** close() 调用：reject 所有仍在等待的 waiter，解除挂起的 use()。 */
  rejectAllWaiters(reason: string): void {
    for (const list of this.#waiters.values()) {
      for (const waiter of list) {
        clearTimeout(waiter.timer)
        waiter.reject(new Error(reason))
      }
    }
    this.#waiters.clear()
  }

  #removeWaiter(name: string, waiter: Waiter): void {
    clearTimeout(waiter.timer)
    const list = this.#waiters.get(name)
    if (list === undefined) return
    list.delete(waiter)
    if (list.size === 0) this.#waiters.delete(name)
  }

  #flushWaiters(name: string): void {
    const list = this.#waiters.get(name)
    if (list === undefined) return
    this.#waiters.delete(name)
    for (const waiter of list) {
      clearTimeout(waiter.timer)
      waiter.resolve()
    }
  }
}
