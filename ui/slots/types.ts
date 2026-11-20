/**
 * 插槽运行时共享类型 —— 被 slots.ts 和各插槽实现文件共同依赖。
 */
import type { Component } from 'vue'

/** List / Single 插槽的条目结构。 */
export interface SlotEntry<Props = unknown> {
  readonly id: number
  readonly component: Component
  readonly props: () => Props
}

/** Pair 插槽的条目结构 —— entry + view 成对注册。 */
export interface PairEntry<EntryProps = unknown, ViewProps = unknown> {
  readonly id: string
  readonly entry: SlotEntry<EntryProps>
  readonly view: SlotEntry<ViewProps>
}
