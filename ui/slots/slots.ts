/**
 * 插槽类型基类 —— 每种插槽形态一个类。
 *
 * 每个插槽位置本身就是一个导出的实例（见 list/ 和 pair/ 子目录），
 * 插件和组件直接 import 那个实例，不需要经过 Registry 间接派发。
 *
 *   import { sidebarPanels } from '@ui/slots/pair/sidebar-panels.ts'
 *   sidebarPanels.register('plugins', entry, view)
 *
 * 全局计数器 _nextEntryId 保证所有插槽的条目 id 全局唯一
 * （避免 Vue v-for key 冲突），模块级闭包自动共享，不需要外部注入。
 */
import type { Component } from 'vue'
import { computed, markRaw, ref, shallowReactive, shallowRef, type ComputedRef, type Ref } from 'vue'
import type { PairEntry, SlotEntry } from './types.ts'

// ---------------------------------------------------------------------------
// 全局条目 id 计数器 —— 模块级闭包，所有插槽共享
// ---------------------------------------------------------------------------

let _nextEntryId = 1

// ---------------------------------------------------------------------------
// ListSlot —— 并列渲染多个条目
// ---------------------------------------------------------------------------

export class ListSlot<Props> {
  /** 插槽名，如 'app.header.actions' */
  readonly name: string
  /** 当前全部条目；响应式，SlotOutlet 直接 v-for */
  readonly entries: readonly SlotEntry<Props>[] = shallowReactive([])

  constructor(name: string) {
    this.name = name
  }

  /** 注册一个条目；返回 disposer，插件卸载时自动撤销。 */
  register(component: Component, props: () => Props): () => void {
    const entry: SlotEntry<Props> = {
      id: _nextEntryId++,
      component: markRaw(component),
      props,
    }
    ;(this.entries as SlotEntry<Props>[]).push(entry)
    return () => {
      const arr = this.entries as SlotEntry<Props>[]
      const idx = arr.findIndex((e) => e.id === entry.id)
      if (idx >= 0) arr.splice(idx, 1)
    }
  }
}

// ---------------------------------------------------------------------------
// PairSlot —— entry + view 成对注册，支持选中态
// ---------------------------------------------------------------------------

export class PairSlot<EntryProps, ViewProps> {
  readonly name: string
  /** 当前全部配对；响应式。 */
  readonly pairs: readonly PairEntry<EntryProps, ViewProps>[] = shallowReactive([])
  /** 当前选中的 id；null 表示回到默认视图（会话页）。响应式 Ref。 */
  readonly activeId = ref<string | null>(null)
  /** 当前选中的那一对；null 表示没有插件视图在位。 */
  readonly active = computed(() => {
    const id = this.activeId.value
    if (id === null) return null
    return (this.pairs as PairEntry<EntryProps, ViewProps>[]).find((p) => p.id === id) ?? null
  })

  constructor(name: string) {
    this.name = name
  }

  /** 注册一对 entry + view；id 必须唯一。 */
  register(
    id: string,
    entry: { component: Component; props: () => EntryProps },
    view: { component: Component; props: () => ViewProps },
  ): () => void {
    const list = this.pairs as PairEntry<EntryProps, ViewProps>[]
    if (list.some((p) => p.id === id)) {
      throw new Error(`pair "${this.name}:${id}" 已经注册`)
    }
    const pair: PairEntry<EntryProps, ViewProps> = {
      id,
      entry: { id: _nextEntryId++, component: markRaw(entry.component), props: entry.props },
      view: { id: _nextEntryId++, component: markRaw(view.component), props: view.props },
    }
    list.push(pair)
    return () => {
      const idx = list.findIndex((p) => p.id === id)
      if (idx >= 0) list.splice(idx, 1)
      if (this.activeId.value === id) this.activeId.value = null
    }
  }

  /** 切换选中；传 null 回到默认视图。 */
  select(id: string | null): void {
    if (id !== null) {
      const list = this.pairs as PairEntry<EntryProps, ViewProps>[]
      if (!list.some((p) => p.id === id)) {
        throw new Error(`pair "${this.name}:${id}" 未注册`)
      }
    }
    this.activeId.value = id
  }
}

// ---------------------------------------------------------------------------
// SingleSlot —— 一个位置，后注册覆盖前注册（预留）
// ---------------------------------------------------------------------------

export class SingleSlot<Props> {
  readonly name: string
  readonly entry: Ref<SlotEntry<Props> | null> = shallowRef<SlotEntry<Props> | null>(null)

  constructor(name: string) {
    this.name = name
  }

  register(component: Component, props: () => Props): () => void {
    if (this.entry.value !== null) {
      throw new Error(`single slot "${this.name}" 已经注册`)
    }
    const e: SlotEntry<Props> = { id: _nextEntryId++, component: markRaw(component), props }
    this.entry.value = e
    return () => {
      if (this.entry.value?.id === e.id) this.entry.value = null
    }
  }
}
