/**
 * 插件注册中心：统一清单 + 启停管理器 + 固定插件装配点。
 *
 * 清单有两个来源（见 types.ts）：
 *   - 内置：builtin.ts 的静态常量，编译期已存在；
 *   - 外置：运行时从 userData/plugins 发现，启用时才动态 import。
 *
 * 两者共用一条生命周期：
 *   enable  → 解析插件对象 → ctx.use() → 记下 scope
 *   disable → scope.dispose() → 插槽注册与视图随之消失
 *
 * 固定插件（builtin.fixed）是这条生命周期的自动启用分支：
 * 启动时由本插件按清单顺序逐个 use，之后不可停用。
 * 因此 main.ts 只需要 use(pluginRegistry)，不再逐个装配固定插件。
 */

import { ref, shallowReactive } from 'vue'
import { getExternalPlugins, getPluginSettings, setPluginSettings } from '@ui/http'
import { BUILTIN_PLUGINS } from './builtin.ts'
import { BRIDGE_SERVICE } from './electron-bridge.ts'
import { loadExternalPlugin } from './external.ts'
import type { Context, Plugin } from '@pkg/cordis'
import type { ExternalPluginIssue, ExternalPluginsResponse } from '../../../shared/dto.ts'
import type { BridgeService } from './electron-bridge.ts'
import type { ExternalPluginMeta, UiPluginMeta } from './types.ts'

/** Service 名，供 inject / require 使用。 */
export const PLUGIN_REGISTRY_SERVICE = 'pluginRegistry'

/** 注册中心对外接口。 */
export interface PluginRegistryService {
  /** 完整清单（内置 + 外置），响应式。 */
  readonly all: readonly UiPluginMeta[]
  /** 当前已启用的 id 集合（含固定插件）。 */
  readonly activeIds: ReadonlySet<string>
  /** 外置插件加载失败原因，按 id 索引；启用成功时清除。 */
  readonly loadErrors: ReadonlyMap<string, string>
  /** 无法识别的外置插件目录。 */
  readonly issues: readonly ExternalPluginIssue[]
  /** 外置插件根目录；首次扫描完成前为空字符串。 */
  readonly externalDir: string
  /** 是否正在扫描外置插件目录。 */
  readonly scanning: boolean
  /** 按 id 查元信息；找不到返回 undefined。 */
  getMeta(id: string): UiPluginMeta | undefined
  /** 启用插件；加载失败会记入 loadErrors 并广播 plugin/error，不抛出。 */
  enable(id: string): Promise<void>
  /** 停用插件；固定插件直接忽略。 */
  disable(id: string): Promise<void>
  /** 已启用则停用，反之启用。 */
  toggle(id: string): Promise<void>
  /** 重新 import 代码（仅外置且正在运行）：停用后以新时间戳重新加载。 */
  reload(id: string): Promise<void>
  /** 重新扫描 userData/plugins，与磁盘现状对齐。 */
  rescan(): Promise<void>
  /** 查询某 id 当前是否已启用（Vue 响应式，可在模板里用）。 */
  isEnabled(id: string): boolean
}

/** 内置 id 集合：外置插件不允许占用这些 id。 */
const BUILTIN_IDS = new Set(BUILTIN_PLUGINS.map((meta) => meta.id))

// ---------------------------------------------------------------------------
// 插件实现
// ---------------------------------------------------------------------------

export const pluginRegistry: Plugin = {
  name: 'plugin-registry',
  async apply(ctx) {
    const catalog = shallowReactive<UiPluginMeta[]>([...BUILTIN_PLUGINS])
    const activeIds = shallowReactive(new Set<string>())
    const loadErrors = shallowReactive(new Map<string, string>())
    const issues = shallowReactive<ExternalPluginIssue[]>([])
    const scopes = new Map<string, Context>()
    /** 正在启停中的插件：await 期间拒绝重入，避免双击导致双重 use。 */
    const pending = new Set<string>()
    const scanning = ref(false)
    const externalDir = ref('')

    // —— 启动：固定插件由 registry 统一装配 ——
    // 清单顺序即装配顺序：electronBridge 必须先就位，下面的 refreshExternal 才能取到桥接服务。
    // 固定插件不得 inject 本 registry 服务 —— 此时服务尚未 provide（它依赖桥接，必须后建）。
    for (const meta of catalog) {
      if (meta.origin !== 'builtin' || !meta.fixed) continue
      await ctx.use(meta.plugin)
      activeIds.add(meta.id)
    }

    // —— 查询 ——

    const getMeta = (id: string): UiPluginMeta | undefined =>
      catalog.find((meta) => meta.id === id)

    const isFixed = (id: string): boolean => {
      const meta = getMeta(id)
      return meta !== undefined && meta.origin === 'builtin' && meta.fixed
    }

    const isEnabled = (id: string): boolean => activeIds.has(id)

    // —— 持久化：只记可切换插件的启用状态 ——

    const persistEnabled = async (id: string): Promise<void> => {
      const enabled = [...activeIds].filter((activeId) => !isFixed(activeId))
      try {
        await saveEnabled(enabled)
      } catch (error) {
        // 持久化失败不回滚内存态，但必须可见：走与加载失败相同的告警通道。
        ctx.emit('plugin/error', { id, error })
      }
    }

    // —— 生命周期 ——

    const resolvePlugin = async (meta: UiPluginMeta): Promise<Plugin> => meta.origin === 'builtin' ? meta.plugin : loadExternalPlugin(meta)

    const enable = async (id: string): Promise<void> => {
      if (isFixed(id) || activeIds.has(id) || pending.has(id)) return
      const meta = getMeta(id)
      if (meta === undefined) throw new Error(`plugin "${id}" not found in registry`)

      pending.add(id)
      try {
        const plugin = await resolvePlugin(meta)
        const scope = await ctx.use(plugin)
        scopes.set(id, scope)
        activeIds.add(id)
        loadErrors.delete(id)
        await persistEnabled(id)
        ctx.emit('plugin/enabled', id)
      } catch (error) {
        loadErrors.set(id, errorMessage(error))
        ctx.emit('plugin/error', { id, error })
      } finally {
        pending.delete(id)
      }
    }

    const disable = async (id: string): Promise<void> => {
      if (isFixed(id) || !activeIds.has(id) || pending.has(id)) return

      pending.add(id)
      try {
        const scope = scopes.get(id)
        if (scope !== undefined) {
          try {
            scope.dispose()
          } catch (error) {
            ctx.emit('plugin/error', { id, error })
          }
          scopes.delete(id)
        }
        activeIds.delete(id)
        await persistEnabled(id)
        ctx.emit('plugin/disabled', id)
      } finally {
        pending.delete(id)
      }
    }

    const toggle = async (id: string): Promise<void> => {
      if (isFixed(id)) return
      if (activeIds.has(id)) await disable(id)
      else await enable(id)
    }

    const reload = async (id: string): Promise<void> => {
      const meta = getMeta(id)
      if (meta?.origin !== 'external' || !activeIds.has(id) || pending.has(id)) return
      await disable(id)
      await enable(id) // 新的时间戳 → 重新拉取并执行磁盘上的最新代码
    }

    // —— 外置清单同步 ——

    const removeFromCatalog = (id: string): void => {
      const index = catalog.findIndex((meta) => meta.id === id)
      if (index >= 0) catalog.splice(index, 1)
      scopes.delete(id)
      loadErrors.delete(id)
    }

    /** 与磁盘现状对齐：消失的停用并移除，新增/变更的更新元信息；运行中的不重载。 */
    const applyCatalog = async (data: ExternalPluginsResponse): Promise<void> => {
      externalDir.value = data.dir
      const incoming = new Map(data.plugins.map((info) => [info.id, info]))

      for (const meta of [...catalog]) {
        if (meta.origin !== 'external' || incoming.has(meta.id)) continue
        if (activeIds.has(meta.id)) await disable(meta.id)
        removeFromCatalog(meta.id)
      }

      for (const info of data.plugins) {
        if (BUILTIN_IDS.has(info.id)) continue // 冲突项只进 issues，不能覆盖内置条目
        const meta: ExternalPluginMeta = {
          origin: 'external',
          id: info.id,
          label: info.label,
          description: info.description,
          version: info.version,
          entry: info.entry,
        }
        const index = catalog.findIndex((item) => item.id === info.id)
        if (index >= 0) catalog[index] = meta
        else catalog.push(meta)
      }

      const conflicts = data.plugins
        .filter((info) => BUILTIN_IDS.has(info.id))
        .map((info) => ({ dir: info.id, reason: '外置插件 id 与内置插件冲突' }))
      issues.splice(0, issues.length, ...data.broken, ...conflicts)
    }

    const rescan = async (): Promise<void> => {
      if (scanning.value) return
      scanning.value = true
      try {
        const [, body] = await getExternalPlugins()
        if (body.code !== 0 || body.data === undefined) {
          ctx.emit('plugin/error', {
            id: 'external-plugins',
            error: new Error(body.msg === '' ? '外置插件扫描失败' : body.msg),
          })
          return
        }
        await applyCatalog(body.data)
      } finally {
        scanning.value = false
      }
    }

    // —— 开发模式热重载：主进程监听源码目录，变化后重扫并重载运行中的外置插件 ——

    const refreshExternal = async (): Promise<void> => {
      await rescan()
      for (const id of [...activeIds]) {
        if (getMeta(id)?.origin === 'external') await reload(id)
      }
    }

    const bridge = ctx.require<BridgeService>(BRIDGE_SERVICE)
    ctx.effect(bridge.onPluginsChanged(() => void refreshExternal()))

    const bootstrap = async (): Promise<void> => {
      const [saved] = await Promise.all([loadSavedEnabled(), rescan()])
      const toggleable = catalog.filter((meta) => meta.origin === 'external' || !meta.fixed)
      const toEnable = saved !== null
        ? toggleable.filter((meta) => saved.has(meta.id))
        : toggleable.filter((meta) => meta.origin === 'builtin' && meta.defaultEnabled === true)

      for (const meta of toEnable) await enable(meta.id)
    }

    const service: PluginRegistryService = {
      all: catalog,
      activeIds,
      loadErrors,
      issues,
      get externalDir() { return externalDir.value },
      get scanning() { return scanning.value },
      getMeta,
      enable,
      disable,
      toggle,
      reload,
      rescan,
      isEnabled,
    }

    ctx.provide<PluginRegistryService>(PLUGIN_REGISTRY_SERVICE, service)
    void bootstrap()
  },
}

// ---------------------------------------------------------------------------
// 持久化：只保存可切换插件的启用状态
// ---------------------------------------------------------------------------

async function saveEnabled(ids: string[]): Promise<void> {
  const [, body] = await setPluginSettings({ enabled: ids })
  if (body.code !== 0) throw new Error(`插件启用状态保存失败：${body.msg || 'api error'}`)
}

async function loadSavedEnabled(): Promise<Set<string> | null> {
  const [, body] = await getPluginSettings()
  if (body.code !== 0) return null
  const list = body.data?.enabled
  if (!Array.isArray(list)) return null
  return new Set(list.filter((id) => typeof id === 'string'))
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
