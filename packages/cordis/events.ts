/**
 * EventBus —— 进程内的发布/订阅。
 *
 * 简化版只保留两个能力：on 注册、emit 广播。监听器复制后遍历，
 * 允许回调里卸载自己。不支持全局事件、不支持 intercept。
 */

import type { Disposer, Listener } from './types.ts'

export class EventBus {
  /** 事件名 → 监听器集合；全局共享，所有 Context 共用同一张表。 */
  readonly #listeners: Map<string, Set<Listener>>

  constructor(listeners?: Map<string, Set<Listener>>) {
    this.#listeners = listeners ?? new Map()
  }

  /** 注册监听器；返回 disposer，卸载时调用。 */
  on(event: string, listener: Listener): Disposer {
    let set = this.#listeners.get(event)
    if (set === undefined) {
      set = new Set()
      this.#listeners.set(event, set)
    }
    set.add(listener)
    return () => set!.delete(listener)
  }

  /** 广播事件；复制一份监听器再遍历，允许回调里卸载自己。 */
  emit(event: string, payload?: unknown): void {
    const set = this.#listeners.get(event)
    if (set === undefined) return
    for (const listener of [...set]) {
      try {
        listener(payload)
      } catch (error) {
        // 一个监听器抛错不能中断广播；内核无 logger，先落 console。
        console.error(`[cordis] listener for "${event}" threw:`, error)
      }
    }
  }
}
