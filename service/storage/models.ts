/**
 * 模型配置读写：models.json。
 */

import { join } from 'node:path'
import type { ModelDef, Vendor } from '@pkg/llm/types.ts'
import { SETTINGS_DIR, readJsonFile, writeJsonFile } from './internal.ts'

const MODELS_FILE = join(SETTINGS_DIR, 'models.json')

const DEFAULT_VENDORS: Vendor[] = [
  {
    id: 'vendor-deepseek',
    name: 'DeepSeek',
    baseURL: 'https://api.deepseek.com/v1',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    models: [
      { id: 'model-chat', modelId: 'deepseek-chat', path: '/chat/completions' },
      { id: 'model-reasoner', modelId: 'deepseek-reasoner', path: '/chat/completions' },
    ],
  },
]

export async function loadModels(): Promise<Vendor[]> {
  return readJsonFile(MODELS_FILE, DEFAULT_VENDORS, parseVendors)
}

export async function saveModels(vendors: Vendor[]): Promise<void> {
  await writeJsonFile(MODELS_FILE, vendors)
}

// —— 形状校验 ——
// PUT 边界与 models.json 读取共用这份规则，与前端 ModelModal.validate 对齐：
// 至少一个厂商、必填字段非空（去首尾空白）、path 以 / 开头、id / modelId 唯一。
// 校验失败抛错，由调用方决定语义。

export function parseVendors(raw: unknown): Vendor[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('vendors must be a non-empty array')
  }
  const vendors = raw.map((item, i) => parseVendor(item, `vendors[${i}]`))
  // 唯一性：vendor.id 与 model.id 是配置标识；modelId 全局唯一——
  // findModel 按 modelId 跨厂商解析，重复即歧义。
  const vendorIds = new Set<string>()
  const defIds = new Set<string>()
  const modelIds = new Set<string>()
  for (const v of vendors) {
    if (vendorIds.has(v.id)) throw new Error(`duplicate vendor id "${v.id}"`)
    vendorIds.add(v.id)
    for (const m of v.models) {
      if (defIds.has(m.id)) throw new Error(`duplicate model id "${m.id}"`)
      defIds.add(m.id)
      if (modelIds.has(m.modelId)) throw new Error(`duplicate modelId "${m.modelId}"`)
      modelIds.add(m.modelId)
    }
  }
  return vendors
}

function parseVendor(raw: unknown, field: string): Vendor {
  const v = asRecord(raw, field)
  if (!Array.isArray(v.models)) {
    throw new Error(`${field}.models must be an array`)
  }
  return {
    id: asString(v.id, `${field}.id`),
    name: asString(v.name, `${field}.name`),
    baseURL: asString(v.baseURL, `${field}.baseURL`),
    apiKeyEnv: asString(v.apiKeyEnv, `${field}.apiKeyEnv`),
    models: v.models.map((m, j) => parseModel(m, `${field}.models[${j}]`)),
  }
}

function parseModel(raw: unknown, field: string): ModelDef {
  const m = asRecord(raw, field)
  const path = asString(m.path, `${field}.path`)
  if (!path.startsWith('/')) {
    throw new Error(`${field}.path must start with "/"`)
  }
  return {
    id: asString(m.id, `${field}.id`),
    modelId: asString(m.modelId, `${field}.modelId`),
    path,
  }
}

function asRecord(raw: unknown, field: string): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(`${field} must be an object`)
  }
  return raw as Record<string, unknown>
}

function asString(raw: unknown, field: string): string {
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new Error(`${field} must be a non-empty string`)
  }
  return raw.trim()
}
