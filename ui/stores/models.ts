/**
 * 模型配置 UI 状态：厂商列表 + 当前对话模型。
 *
 * 纯 Pinia store。初始加载由 App.vue 负责；
 * ModelModal 保存后调 load() 刷新。
 * 选中模型随 POST /api/chat 发送。
 *
 * 只有 language 类别可作为对话主模型：其余类别是能力声明，
 * 由生成类工具按类别自行取用，不进入对话模型选择器。
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getVendors } from '@ui/http'
import type { ModelDef, Vendor } from '@pkg/llm/types.ts'

/** 对话候选：模型本身 + 所属厂商（选择器按厂商分组展示）。 */
export interface ChatModelOption {
  vendor: Vendor
  model: ModelDef
}

export const useModelsStore = defineStore('models', () => {
  //states
  const vendors = ref<readonly Vendor[]>([])
  const selectedModelId = ref<string | null>(null)

  //computed
  /** 可作对话主模型的候选：只含 language 类别。 */
  const chatModels = computed<ChatModelOption[]>(() =>
    vendors.value.flatMap((vendor) =>
      vendor.models
        .filter((model) => model.category === 'language')
        .map((model) => ({ vendor, model })),
    ),
  )

  //methods
  /** 拉取最新厂商配置；失败返回错误文案，成功返回 null。 */
  async function load(): Promise<string | null> {
    const [, body] = await getVendors()
    if (body.code !== 0) return `加载失败：${body.msg || 'api error'}`

    vendors.value = body.data ?? []
    // 选中模型仍在对话候选中则保留，否则回退到第一个语言模型。
    if (!chatModels.value.some((option) => option.model.modelId === selectedModelId.value)) {
      selectedModelId.value = chatModels.value[0]?.model.modelId ?? null
    }

    return null
  }

  return { vendors, selectedModelId, chatModels, load }
})
