/**
 * 插件注册中心：清单 + 启停管理器。
 *
 * 清单列出**全部插件**——包括固定插件（fixed: true，main.ts 直接 use，不能关）
 * 和可切换插件（toggleable，registry 按 HTTP 持久化或 defaultEnabled 启停）。
 * registry 对 fixed 插件只在 activeIds 里标记"已启用"，不插手加载/卸载。
 *
 *   - 固定插件：渲染器、连接层、插件管理、状态栏条目……基础架构，关不掉。
 *   - 可切换插件：schedules-page（定时任务）……用户可 toggle。
 *
 * import 顺序：pluginRegistry 必须在所有 fixed 插件之前 use——这样 registry
 * 启动时就能把 fixed 全部标记进 activeIds，plugins-page 视图完整显示。
 */

import { shallowReactive } from 'vue'
import type { Context, Plugin } from '@pkg/cordis'
import { getPluginSettings, setPluginSettings } from '@ui/http/plugins.ts'
import { electronBridge } from '@ui/plugins/core/electron-bridge.ts'
import { pluginsPage } from '@ui/plugins/plugins-page/plugins-page.ts'
import { sessionPathItem } from '@ui/plugins/statusbar/session-path/session-path.ts'
import { versionItem } from '@ui/plugins/statusbar/version/version.ts'
import { workingDirItem } from '@ui/plugins/statusbar/working-dir/working-dir.ts'
import { vueRenderer } from '@ui/renderer/vue-renderer.ts'
import { schedulesPage } from '@ui/plugins/schedules-page/schedules-page.ts'

/** Service 名，供 inject / require 使用。 */
export const PLUGIN_REGISTRY_SERVICE = 'pluginRegistry'

/** 清单条目——描述一个插件在插件管理视图中的元信息。 */
export interface UiPluginMeta {
  /** 唯一标识；与 Plugin.name 对应。 */
  id: string
  /** 插件对象（fixed 条目只用于展示，不通过 registry enable）。 */
  plugin: Plugin
  /** 用户可见名称。 */
  label: string
  /** 用户可见描述（可选）。 */
  description?: string
  /** 是否固定插件——固定插件在 main.ts 直接 use，不能 toggle。 */
  fixed?: boolean
  /** 可切换插件的默认启用状态（持久化缺失时的初始值）。 */
  defaultEnabled?: boolean
}

/** 注册中心对外接口。 */
export interface PluginRegistryService {
  /** 完整清单（只读）。 */
  readonly all: readonly UiPluginMeta[]
  /** 当前已启用的 id 集合（Vue 响应式；fixed 的也会出现在这里）。 */
  readonly activeIds: ReadonlySet<string>
  /** 按 id 查元信息；找不到返回 undefined。 */
  getMeta(id: string): UiPluginMeta | undefined
  /** 启用可切换插件；fixed 的直接拒绝。已启用时 no-op。 */
  enable(id: string): Promise<void>
  /** 禁用可切换插件；fixed 的直接拒绝。未启用时 no-op。 */
  disable(id: string): Promise<void>
  /** 当前启用的可切换插件就禁用，反之就启用；fixed 的直接拒绝。 */
  toggle(id: string): Promise<void>
  /** 查询某 id 当前是否已启用（Vue 响应式，可在模板里用）。 */
  isEnabled(id: string): boolean
}

// ---------------------------------------------------------------------------
// 完整清单 —— 全部插件都在这里出现。fixed 条目不经过 enable 链路，
// 在 main.ts 里由 bootstrap 直接 use，registry 只负责"知道它们存在"。
// ---------------------------------------------------------------------------

export const UI_PLUGINS: UiPluginMeta[] = [
  // —— 固定插件（基础架构，关不掉）——
  { id: vueRenderer.name,    plugin: vueRenderer,    label: '渲染器',   fixed: true, description: 'Vue 渲染进程挂载' },
  { id: electronBridge.name, plugin: electronBridge, label: '连接', fixed: true, description: '主进程 IPC 通信' },
  { id: pluginsPage.name,    plugin: pluginsPage,    label: '插件仓库', fixed: true, description: '插件管理界面' },
  { id: workingDirItem.name, plugin: workingDirItem, label: '工作目录', fixed: false, description: '状态栏条目' },
  { id: sessionPathItem.name, plugin: sessionPathItem, label: '会话路径', fixed: false, description: '状态栏条目' },
  { id: versionItem.name,    plugin: versionItem,    label: '版本号',   fixed: false, description: '状态栏条目' },

  // —— 可切换插件（用户可 toggle）——
  { id: schedulesPage.name, plugin: schedulesPage, label: '定时任务', defaultEnabled: false, description: '定时执行的日程管理' },
]

// ---------------------------------------------------------------------------
// 持久化 —— 只记住可切换插件的启用状态
// 通过 HTTP 写入 userData/settings/plugins.json
// ---------------------------------------------------------------------------

/** 可切换插件 id 列表，按顺序过滤。 */
const TOGGLABLE_IDS = UI_PLUGINS
  .filter((m) => !m.fixed)
  .map((m) => m.id)

async function loadSavedEnabled(): Promise<Set<string> | null> {
  const [err, body] = await getPluginSettings()
  if (err) return null
  const list = body?.data?.enabled
  if (!Array.isArray(list)) return null
  return new Set(list.filter((v) => typeof v === 'string' && TOGGLABLE_IDS.includes(v)))
}

async function saveEnabled(ids: ReadonlySet<string>): Promise<void> {
  const toSave = [...ids].filter((id) => TOGGLABLE_IDS.includes(id))
  const [err] = await setPluginSettings({ enabled: toSave })
  // 持久化失败不影响内存态，但必须可见：由调用方转成 plugin/error 告警。
  if (err) throw new Error(`插件启用状态保存失败：${err.message}`)
}

// ---------------------------------------------------------------------------
// Plugin 实现
// ---------------------------------------------------------------------------

export const pluginRegistry: Plugin = {
  name: 'plugin-registry',
  apply(ctx) {
    const scopes = new Map<string, Context>()
    /** 正在启停中的插件：await 期间拒绝重入，避免双击导致双重 use。 */
    const pending = new Set<string>()
    // shallowReactive 让 Vue detect 到 Set 的 add/delete 变化
    const activeIds: Set<string> = shallowReactive(new Set())

    const all = Object.freeze(UI_PLUGINS)

    const getMeta = (id: string): UiPluginMeta | undefined =>
      all.find((m) => m.id === id)

    const isFixed = (id: string): boolean => getMeta(id)?.fixed === true

    const isEnabled = (id: string): boolean => activeIds.has(id)

    // 持久化失败不回滚内存态，但与加载失败走同一告警通道（main.ts 消费）。
    const persistEnabled = async (id: string): Promise<void> => {
      try {
        await saveEnabled(activeIds)
      } catch (error) {
        ctx.emit('plugin/error', { id, error })
      }
    }

    const enable = async (id: string): Promise<void> => {
      if (isFixed(id)) throw new Error(`plugin "${id}" is fixed, cannot enable/disable`)
      if (activeIds.has(id) || pending.has(id)) return
      const meta = getMeta(id)
      if (!meta) throw new Error(`plugin "${id}" not found in registry`)
      pending.add(id)
      try {
        const scope = await ctx.use(meta.plugin)
        scopes.set(id, scope)
        activeIds.add(id)
        await persistEnabled(id)
        ctx.emit('plugin/enabled', id)
      } finally {
        pending.delete(id)
      }
    }

    const disable = async (id: string): Promise<void> => {
      if (isFixed(id)) throw new Error(`plugin "${id}" is fixed, cannot enable/disable`)
      if (!activeIds.has(id) || pending.has(id)) return
      const scope = scopes.get(id)
      if (scope === undefined) return
      pending.add(id)
      try {
        scope.dispose()
        scopes.delete(id)
        activeIds.delete(id)
        await persistEnabled(id)
        ctx.emit('plugin/disabled', id)
      } finally {
        pending.delete(id)
      }
    }

    const toggle = async (id: string): Promise<void> => {
      if (isFixed(id)) return  // fixed 插件，no-op（UI 应该禁用按钮）
      if (activeIds.has(id)) await disable(id)
      else await enable(id)
    }

    const service: PluginRegistryService = {
      all,
      activeIds,
      getMeta,
      enable,
      disable,
      toggle,
      isEnabled,
    }

    ctx.provide<PluginRegistryService>(PLUGIN_REGISTRY_SERVICE, service)

    // —— 同步标记 fixed 插件为 active（它们在 main.ts 里接着 use）——
    for (const meta of all) {
      if (meta.fixed) activeIds.add(meta.id)
    }

    // —— 异步初始化可切换插件（读 HTTP，缺省时用 defaultEnabled）——
    void (async () => {
      const saved = await loadSavedEnabled()
      const togglable = all.filter((m) => !m.fixed)
      const toEnable = saved !== null
        ? togglable.filter((m) => saved.has(m.id))
        : togglable.filter((m) => m.defaultEnabled)

      for (const meta of toEnable) {
        try {
          await enable(meta.id)
        } catch (error) {
          ctx.emit('plugin/error', { id: meta.id, error })
        }
      }
    })()
  },
}
