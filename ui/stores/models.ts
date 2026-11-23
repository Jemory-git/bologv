/**
 * 模型配置 UI 状态：厂商列表 + 当前选中模型。
 *
 * 纯 Pinia store。初始加载由 App.vue 负责；
 * ModelModal 保存后调 load() 刷新。
 * 选中模型随 POST /api/chat 发送。
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getVendors } from '@ui/http'
import type { Vendor } from '@pkg/llm/types.ts'

export const useModelsStore = defineStore('models', () => {
  //states
  const vendors = ref<readonly Vendor[]>([])
  const selectedModelId = ref<string | null>(null)

  //methods
  /** 拉取最新厂商配置；失败返回错误文案，成功返回 null。 */
  async function load(): Promise<string | null> {
    const [err, body] = await getVendors()
    if (err) return `加载失败：${err.message}`
    if (body.code !== 0) return `加载失败：${body.msg || 'api error'}`

    vendors.value = body.data ?? []
    // 选中模型仍在最新配置里则保留，否则回退到第一个可用模型。
    const models = vendors.value.flatMap((v) => v.models)
    if (!models.some((m) => m.modelId === selectedModelId.value)) {
      selectedModelId.value = models[0]?.modelId ?? null
    }

    return null
  }

  return { vendors, selectedModelId, load }
})
