/**
 * 插槽类型基类 —— 每种插槽形态一个类。
 *
 * 每个插槽位置本身就是一个导出的实例（见 list/ 和 pair/ 子目录），
 * 插件和组件直接 import 那个实例，不需要经过 Registry 间接派发。
 *
 *   import { sidebarPanels } from '@ui/slots'
 *   sidebarPanels.register('plugins', entry, view)
 *
 * 实例自带自描述元信息（SlotMeta）：插件页的「可用插槽」直接读实例，
 * 不需要另外维护一份静态清单，新增插槽也不会漏改。
 *
 * 全局计数器 _nextEntryId 保证所有插槽的条目 id 全局唯一
 * （避免 Vue v-for key 冲突），模块级闭包自动共享，不需要外部注入。
 */
import type { Component, Ref } from 'vue'
import { computed, markRaw, ref, shallowReactive, shallowRef } from 'vue'
import type {
  PairEntry,
  SlotDescriptor,
  SlotEntry,
  SlotKind,
  SlotMeta,
  SlotMetaInput,
} from './types.ts'

// ---------------------------------------------------------------------------
// 全局条目 id 计数器 —— 模块级闭包，所有插槽共享
// ---------------------------------------------------------------------------

let _nextEntryId = 1

// ---------------------------------------------------------------------------
// SlotBase —— 标识 + 元信息 + 占用数，子类只管条目存储
// ---------------------------------------------------------------------------

export abstract class SlotBase implements SlotDescriptor {
  /** 插槽名，与 meta.id 相同，如 'app.header.left'。 */
  readonly name: string
  /** 自描述元信息；kind 由子类在构造时确定。 */
  readonly meta: SlotMeta

  constructor(input: SlotMetaInput, kind: SlotKind) {
    this.meta = { ...input, kind }
    this.name = input.id
  }

  /** 当前已注册条目数；插件页用它展示占用情况。 */
  abstract get count(): number
}

// ---------------------------------------------------------------------------
// ListSlot —— 并列渲染多个条目
// ---------------------------------------------------------------------------

export class ListSlot<PropsT> extends SlotBase {
  /** 当前全部条目；响应式，ListSlotOutlet 直接 v-for */
  readonly entries: readonly SlotEntry<PropsT>[] = shallowReactive([])

  constructor(input: SlotMetaInput) {
    super(input, 'list')
  }

  get count(): number {
    return this.entries.length
  }

  /** 注册一个条目；返回 disposer，插件卸载时自动撤销。 */
  register(component: Component, props: () => PropsT): () => void {
    const entry: SlotEntry<PropsT> = {
      id: _nextEntryId++,
      component: markRaw(component),
      props,
    };
    (this.entries as SlotEntry<PropsT>[]).push(entry)

    return () => {
      const arr = this.entries as SlotEntry<PropsT>[]
      const idx = arr.findIndex((e) => e.id === entry.id)
      if (idx >= 0) arr.splice(idx, 1)
    }
  }
}

// ---------------------------------------------------------------------------
// PairSlot —— entry + view 成对注册，支持选中态
// ---------------------------------------------------------------------------

export class PairSlot<EntryProps, ViewProps> extends SlotBase {
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

  constructor(input: SlotMetaInput) {
    super(input, 'pair')
  }

  get count(): number {
    return this.pairs.length
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
    if (this.activeId.value === id) return
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
// ExclusiveSlot —— 一个位置，同时只允许一个条目（预留）
// ---------------------------------------------------------------------------

export class ExclusiveSlot<PropsT> extends SlotBase {
  readonly entry: Ref<SlotEntry<PropsT> | null> = shallowRef<SlotEntry<PropsT> | null>(null)

  constructor(input: SlotMetaInput) {
    super(input, 'exclusive')
  }

  get count(): number {
    return this.entry.value === null ? 0 : 1
  }

  register(component: Component, props: () => PropsT): () => void {
    if (this.entry.value !== null) {
      throw new Error(`exclusive slot "${this.name}" 已经注册`)
    }
    const e: SlotEntry<PropsT> = { id: _nextEntryId++, component: markRaw(component), props }
    this.entry.value = e
    return () => {
      if (this.entry.value?.id === e.id) this.entry.value = null
    }
  }
}
