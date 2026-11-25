/**
 * UI 插件元信息与外置插件 ABI。
 *
 * 清单有两个来源，用 origin 区分：
 *   builtin  —— 编译期静态插件，plugin 字段直接可 use；
 *   external —— 运行时从 userData/plugins 发现，启用时才 import 代码。
 * 两种来源共用同一条启停生命周期（见 plugin-registry.ts）。
 */

import type { Component } from 'vue'
import type { Plugin } from '@pkg/cordis'
import type { ExternalVueApi } from './vue-api.ts'

interface UiPluginBase {
  id: string
  label: string
  description?: string
}

export interface BuiltinPluginMeta extends UiPluginBase {
  origin: 'builtin'
  plugin: Plugin
  /** 固定插件由 registry 启动时统一 use，不可停用。 */
  fixed: boolean
  /** 持久化缺失时的初始启用状态（仅可切换插件有效）。 */
  defaultEnabled?: boolean
}

export interface ExternalPluginMeta extends UiPluginBase {
  origin: 'external'
  version?: string
  /** 入口文件名，相对插件目录；URL 由 external.ts 统一拼接。 */
  entry: string
}

export type UiPluginMeta = BuiltinPluginMeta | ExternalPluginMeta

// —— 外置插件 ABI ——

/** DOM 模式：插件拿到宿主提供的容器，自己往里写；返回的函数在视图卸载时调用。 */
export type ExternalPanelMount = (el: HTMLElement) => void | (() => void)

interface ExternalPanelBase {
  /** 插件内唯一即可；宿主会加上插件前缀，避免与内置面板冲突。 */
  id: string
  label: string
}

/**
 * 视图内容二选一，面板与状态栏条目共用：
 *   mount     —— 纯 DOM，插件完全掌控容器内容；
 *   component —— Vue 组件，由宿主渲染，组件内使用 host.vue 的运行时。
 */
export type ExternalViewOptions =
  | { mount: ExternalPanelMount; component?: never }
  | { component: Component; mount?: never }

/** 面板 = 入口信息 + 视图内容；状态栏条目没有入口，只用 ExternalViewOptions。 */
export type ExternalPanelOptions = ExternalPanelBase & ExternalViewOptions

/** ExternalViewHost 的 props；mount 与 component 互斥，由宿主注册时校验。 */
export interface ExternalViewHostProps {
  mount?: ExternalPanelMount
  component?: Component
}

/** 外置插件能看到的全部能力；这就是它的权限边界（没有 Node、没有 Cordis）。 */
export interface ExternalHost {
  readonly id: string
  readonly version: string
  /** 宿主这一份 Vue 运行时；插件不能写裸 'vue' 导入，必须从这里取。 */
  readonly vue: ExternalVueApi
  readonly ui: {
    registerPanel(options: ExternalPanelOptions): void
    /** 状态栏条目没有入口按钮，因此不需要 id/label；排版继承状态栏。 */
    registerStatusBar(options: ExternalViewOptions): void
    /** 注入全局样式，随插件停用一起移除（外置插件没有构建步骤，也没有 SFC 样式块）。 */
    injectStyle(css: string): void
  }
  log(...args: unknown[]): void
}

export interface ExternalPluginModule {
  apply(host: ExternalHost): void | Promise<void>
}
