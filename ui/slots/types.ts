/**
 * 插槽运行时共享类型 —— 被 slots.ts 和各插槽实现文件共同依赖。
 */
import type { Component } from 'vue'

/** List / exclusive 插槽的条目结构。 */
export interface SlotEntry<PropsT = unknown> {
  readonly id: number
  readonly component: Component
  readonly props: () => PropsT
}

/** Pair 插槽的条目结构 —— entry + view 成对注册。 */
export interface PairEntry<EntryProps = unknown, ViewProps = unknown> {
  readonly id: string
  readonly entry: SlotEntry<EntryProps>
  readonly view: SlotEntry<ViewProps>
}

/**
 * Pair 入口组件的控制面，由 PairSlotOutlet 注入（不属于注册方声明的 props）。
 *
 *   active —— 当前是否选中；
 *   select —— 点击入口时调用，选中自己（已选中时重复点击无副作用）。
 *
 * 入口组件的 props 必须包含这两个字段，选中态维护完全留在槽位内部。
 */
export interface PairEntryControl {
  active: boolean
  select: () => void
}

/** 插槽形态，决定条目是并列、成对还是单例。 */
export type SlotKind = 'list' | 'pair' | 'exclusive'

/** 谁能往这个插槽注册内容；只有 external 的插槽才会出现在外置 ABI 里。 */
export type SlotAccess = 'external' | 'builtin-only'

/** 定义插槽时提供的自描述信息（kind 由插槽类自己补）。 */
export interface SlotMetaInput {
  /** 插槽标识，与实例 name 一致，如 'sidebar.panels'。 */
  readonly id: string
  /** 中文名，展示用。 */
  readonly label: string
  /** 渲染在界面哪里、什么场景该用。 */
  readonly description: string
  readonly access: SlotAccess
  /** 注册方式示意：内置 import 路径，或外置 host ABI 调用形式。 */
  readonly usage: string
}

/** 插槽完整元信息；插件页据此渲染清单，不另维护静态描述表。 */
export interface SlotMeta extends SlotMetaInput {
  readonly kind: SlotKind
}

/** 插槽实例的只读公共面：消费者不关心具体泛型。 */
export interface SlotDescriptor {
  readonly meta: SlotMeta
  /** 当前已注册条目数（Single 插槽为 0 或 1）。 */
  readonly count: number
}
