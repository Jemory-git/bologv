/**
 * 工具配置 UI 状态：catalog（生效值）+ 用户 settings（持久化原始值）。
 *
 * 显示一律读 catalog 的生效 enabled/favorite（框架约束 + 用户配置合并后）；
 * toggle 即时写回后端并热更新，再拉 catalog 反映最新生效状态。
 * 框架级工具（disableable/favoriteEditable=false）的 toggle 被忽略。
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getToolCatalog, getToolSettings, putToolSettings } from '@ui/http'
import type { ToolCatalogItem, ToolSettings, ToolSettingsEntry } from '@pkg/tools'

export const useToolsStore = defineStore('tools', () => {
  //states
  const catalog = ref<readonly ToolCatalogItem[]>([])
  const settings = ref<ToolSettings>({})
  const saving = ref(false)

  //methods
  async function load(): Promise<string | null> {
    const [err1, body1] = await getToolCatalog()
    if (err1 || body1.code !== 0) return `加载 catalog 失败：${body1.msg || err1?.message}`
    catalog.value = body1.data?.tools ?? []

    const [err2, body2] = await getToolSettings()
    if (err2 || body2.code !== 0) return `加载 settings 失败：${body2.msg || err2?.message}`
    settings.value = body2.data ?? {}

    return null
  }

  /** 切换启用；不可禁用的工具忽略。 */
  async function toggleEnabled(item: ToolCatalogItem): Promise<string | null> {
    if (!item.disableable) return null
    return persist(item.name, { enabled: !item.enabled })
  }

  /** 切换常用；favorite 不可改的工具忽略。 */
  async function toggleFavorite(item: ToolCatalogItem): Promise<string | null> {
    if (!item.favoriteEditable) return null
    return persist(item.name, { favorite: !item.favorite })
  }

  /** 写回用户配置 → 后端热更新 → 重新拉 catalog 反映生效状态。 */
  async function persist(name: string, patch: Partial<ToolSettingsEntry>): Promise<string | null> {
    const current = settings.value[name] ?? { enabled: true, favorite: false }
    settings.value = { ...settings.value, [name]: { ...current, ...patch } }

    saving.value = true
    const [err, body] = await putToolSettings(settings.value)
    if (err || body.code !== 0) {
      saving.value = false
      return `保存失败：${body.msg || err?.message}`
    }
    const [cerr, cbody] = await getToolCatalog()
    saving.value = false
    if (cerr || cbody.code !== 0) return `刷新失败：${cbody.msg || cerr?.message}`
    catalog.value = cbody.data?.tools ?? []
    return null
  }

  return { catalog, saving, load, toggleEnabled, toggleFavorite }
})
