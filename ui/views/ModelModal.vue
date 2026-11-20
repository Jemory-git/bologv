<script setup lang="ts">
/**
 * 模型配置：两层结构，全部来自/写入 settings/models.json
 *   Vendor  → 厂商：baseURL + apiKeyEnv（环境变量名）
 *   ModelDef → 模型：modelId + path，归属某个 vendor
 *
 * 数据源是 models store：打开时 load() 取最新配置做本地草稿；
 * 保存成功后再 load() 刷新 store，选中模型即时生效。
 *
 * 脚本编排顺序：states → methods → events → hooks → expose
 */

// ———————————— imports ————————————
import { computed, onMounted, reactive, ref, toRaw } from 'vue'
import { setVendors } from '@ui/http'
import { useModelsStore } from '@ui/stores/models.ts'
import type { Ref } from 'vue'
import type { Vendor } from '@pkg/llm/types.ts'

// ============================================================================
// states
// ============================================================================

const models = useModelsStore()

// —— 厂商数据（从 models store 加载的本地草稿）——
const vendors = reactive<Vendor[]>([])
const selectedId: Ref<string | null> = ref(null)
const selected = computed(() => vendors.find((v) => v.id === selectedId.value) ?? null)

// —— 加载/保存状态 ——
const loading = ref(true)
const saving = ref(false)
const error = ref<string | null>(null)

// ============================================================================
// methods
// ============================================================================

function uid(): string {
  return window.crypto.randomUUID()
}

// —— 厂商操作 ——

function addVendor(): void {
  const v: Vendor = {
    id: uid(),
    name: 'New Vendor',
    baseURL: '',
    apiKeyEnv: '',
    models: [],
  }
  vendors.push(v)
  selectedId.value = v.id
}

function removeVendor(id: string): void {
  const idx = vendors.findIndex((v) => v.id === id)
  if (idx === -1) return
  vendors.splice(idx, 1)
  if (selectedId.value === id) {
    selectedId.value = vendors[idx]?.id ?? vendors[idx - 1]?.id ?? null
  }
}

// —— 模型操作 ——

function addModel(vendorId: string): void {
  const v = vendors.find((v) => v.id === vendorId)
  if (!v) return
  v.models.push({ id: uid(), modelId: '', path: '/chat/completions' })
}

function removeModel(vendorId: string, modelId: string): void {
  const v = vendors.find((v) => v.id === vendorId)
  if (!v) return
  const idx = v.models.findIndex((m) => m.id === modelId)
  if (idx !== -1) v.models.splice(idx, 1)
}

// —— 校验 & 保存 ——

function validate(): string | null {
  if (vendors.length === 0) return '至少需要一个厂商'
  for (const v of vendors) {
    if (!v.name.trim()) return '厂商名不能为空'
    if (!v.baseURL.trim()) return `厂商 ${v.name} 的 baseURL 不能为空`
    if (!v.apiKeyEnv.trim()) return `厂商 ${v.name} 需要填写 API Key 环境变量名`
    for (const m of v.models) {
      if (!m.modelId.trim()) return `厂商 ${v.name} 有未填写 modelId 的模型`
      if (!m.path.startsWith('/')) return `模型 ${m.modelId || '(未填)'} 的 path 必须以 / 开头`
    }
  }
  return null
}

async function handleSave(): Promise<void> {
  const err = validate()
  if (err !== null) {
    error.value = err
    return
  }
  error.value = null
  saving.value = true
  const [httpErr, body] = await setVendors({ vendors })
  saving.value = false
  if (httpErr) {
    error.value = `保存失败：${httpErr.message}`
    return
  }
  if (body.code !== 0) {
    error.value = `保存失败：${body.msg || 'api error'}`
    return
  }
  const refreshErr = await models.load()
  if (refreshErr !== null) {
    error.value = refreshErr
    return
  }
  emit('close')
}

// ============================================================================
// events
// ============================================================================

const emit = defineEmits<{
  (e: 'close'): void
}>()

// ============================================================================
// hooks
// ============================================================================

onMounted(async () => {
  const loadErr = await models.load()
  loading.value = false
  if (loadErr !== null) {
    error.value = loadErr
    return
  }
  vendors.splice(0, vendors.length, ...structuredClone(toRaw(models.vendors)))
  selectedId.value = vendors[0]?.id ?? null
})

// ============================================================================
// expose
// ============================================================================
// (无)
</script>

<template>
  <div class="model-modal">
    <!-- 左侧：厂商列表 -->
    <aside class="vendor-pane thin-bar">
      <header class="pane-header">
        <h3>厂商</h3>
        <button type="button" class="btn btn-ghost btn-small" @click="addVendor">+ 新增</button>
      </header>

      <div v-if="loading" class="empty-hint">加载中…</div>
      <ul v-else-if="vendors.length > 0" class="vendor-list">
        <li v-for="v in vendors" :key="v.id" class="vendor-item" :class="{ active: v.id === selectedId }"
          @click="selectedId = v.id">
          <span class="vendor-name">{{ v.name || '(未命名)' }}</span>
          <button type="button" class="btn-delete" title="删除厂商" @click.stop="removeVendor(v.id)">✕</button>
        </li>
      </ul>
      <p v-else class="empty-hint">还没有厂商，点击上方「+ 新增」</p>
    </aside>

    <!-- 右侧：详情 + 模型表格 -->
    <section class="detail-pane" v-if="selected">
      <header class="pane-header">
        <h3>{{ selected.name || '(未命名厂商)' }}</h3>
      </header>

      <div class="vendor-info">
        <div class="form-grid">
          <div class="form-group">
            <label class="label">名称</label>
            <input v-model="selected.name" type="text" class="input" placeholder="DeepSeek" />
          </div>
          <div class="form-group">
            <label class="label">Base URL</label>
            <input v-model="selected.baseURL" type="text" class="input" placeholder="https://api.deepseek.com/v1" />
          </div>
          <div class="form-group">
            <label class="label">API Key 环境变量名</label>
            <input v-model="selected.apiKeyEnv" type="text" class="input" placeholder="DEEPSEEK_API_KEY" />
          </div>
        </div>
        <p class="field-hint">
          请在系统环境变量中设置 <code>{{ selected.apiKeyEnv || '(变量名)' }}</code>，值为你的 API Key。
          例如
          PowerShell：<code>[Environment]::SetEnvironmentVariable('{{ selected.apiKeyEnv || 'VAR_NAME' }}', 'sk-...', 'User')</code>
        </p>
      </div>

      <hr class="divider" />

      <div class="models-section">
        <div class="models-header">
          <h4>模型</h4>
          <button type="button" class="btn btn-ghost btn-small" @click="addModel(selected.id)">+ 新增模型</button>
        </div>

        <div v-if="selected.models.length > 0" class="models-table-wrap">
          <table class="models-table">
            <thead>
              <tr>
                <th>Model ID</th>
                <th>Path</th>
                <th class="col-actions"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in selected.models" :key="m.id">
                <td><input v-model="m.modelId" type="text" class="input input-sm" placeholder="deepseek-chat" /></td>
                <td><input v-model="m.path" type="text" class="input input-sm" placeholder="/chat/completions" /></td>
                <td class="col-actions">
                  <button type="button" class="btn-row-del" title="删除"
                    @click="removeModel(selected.id, m.id)">✕</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="empty-hint">还没有模型，点击「+ 新增模型」</p>
      </div>

      <footer class="form-actions">
        <p v-if="error" class="form-error">{{ error }}</p>
        <div class="spacer" />
        <button type="button" class="btn btn-ghost" @click="emit('close')">取消</button>
        <button type="button" class="btn btn-primary" :disabled="saving || loading" @click="handleSave">
          {{ saving ? '保存中…' : '保存' }}
        </button>
      </footer>
    </section>

    <!-- 空态 -->
    <section v-else class="detail-pane empty-pane">
      <p class="empty-hint">← 请从左侧选择或新增一个厂商</p>
    </section>
  </div>
</template>

<style scoped lang="scss">
/* ==========================================================================
   Structure: .model-modal > .vendor-pane | .detail-pane(.empty-pane)
   通用元素：.btn, .input, .pane-header, .empty-hint, .divider, .spacer
   ========================================================================== */

.model-modal {
  display: flex;
  gap: 2rem;
  height: 100%;
  min-height: 0;

  /* —— 左侧：厂商列表 —— */
  .vendor-pane {
    width: 20rem;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
    padding-right: 2rem;
    border-right: 0.1rem solid var(--line);
    overflow-y: auto;

    .vendor-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .vendor-item {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.8rem 1rem;
      border-radius: 0.6rem;
      cursor: pointer;
      font-size: 1.3rem;
      color: var(--muted);

      &:hover {
        background: var(--panel-2);
        color: var(--text);
      }

      &.active {
        background: var(--accent-soft);
        color: var(--text);
      }

      .vendor-name {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .btn-delete {
        opacity: 0;
        border: none;
        background: transparent;
        color: var(--muted);
        font-size: 1rem;
        cursor: pointer;
        padding: 0.2rem 0.4rem;
        border-radius: 0.3rem;

        &:hover {
          color: var(--fail);
        }

        .vendor-item:hover &,
        .vendor-item.active & {
          opacity: 1;
        }
      }
    }
  }

  /* —— 右侧：详情面板 —— */
  .detail-pane {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 1.6rem;

    &.empty-pane {
      align-items: center;
      justify-content: center;
      color: var(--muted);
    }

    /* —— 上：厂商信息（固定）—— */
    .vendor-info {
      flex-shrink: 0;

      .form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1.2rem 1.6rem;
      }

      .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;

        &:last-child:nth-child(odd) {
          grid-column: span 2;
        }
      }

      .label {
        font-size: 1.2rem;
        color: var(--muted);
      }

      .field-hint {
        margin: 0.4rem 0 0;
        font-size: 1.1rem;
        color: var(--muted);
        line-height: 1.5;

        code {
          background: var(--panel-2);
          padding: 0.1rem 0.4rem;
          border-radius: 0.3rem;
          font-size: 1rem;
        }
      }
    }

    .divider {
      border: none;
      border-top: 0.1rem solid var(--line);
      margin: 0;
    }

    /* —— 中：模型区（唯一滚动）—— */
    .models-section {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      overflow-y: auto;

      .models-header {
        display: flex;
        align-items: center;
        justify-content: space-between;

        h4 {
          margin: 0;
          font-size: 1.2rem;
          color: var(--text);
          font-weight: 600;
        }
      }

      .models-table-wrap {
        border: 0.1rem solid var(--line);
        border-radius: 0.6rem;
        overflow: hidden;
      }

      .models-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 1.2rem;

        th,
        td {
          padding: 0.6rem 0.8rem;
          text-align: left;
          border-bottom: 0.1rem solid var(--line);
        }

        thead th {
          background: var(--panel-2);
          color: var(--muted);
          font-weight: 500;
          font-size: 1.1rem;
        }

        tbody {
          tr:last-child td {
            border-bottom: none;
          }

          tr:hover {
            background: var(--panel-2);
          }
        }

        .input {
          min-width: 8rem;
        }

        .col-actions {
          width: 3rem;
          text-align: center;
        }

        .btn-row-del {
          border: none;
          background: transparent;
          color: var(--muted);
          font-size: 1rem;
          cursor: pointer;
          padding: 0.2rem 0.4rem;
          border-radius: 0.3rem;
          opacity: 0.3;

          tr:hover & {
            opacity: 1;
          }

          &:hover {
            color: var(--fail);
            opacity: 1;
          }
        }
      }
    }

    /* —— 下：按钮区（固定）—— */
    .form-actions {
      display: flex;
      align-items: center;
      gap: 0.8rem;
      padding-top: 1.2rem;
      border-top: 0.1rem solid var(--line);
      flex-shrink: 0;

      .form-error {
        color: var(--fail);
        font-size: 1.2rem;
        margin: 0;
      }
    }
  }

  /* —— 通用：两侧 pane 共用 —— */

  .pane-header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    h3 {
      margin: 0;
      font-size: 1.3rem;
      font-weight: 600;
      color: var(--text);
    }
  }

  .empty-hint {
    font-size: 1.2rem;
    color: var(--muted);
    margin: 0;
  }

  .input {
    width: 100%;
    padding: 0.7rem 1rem;
    border: 0.1rem solid var(--line);
    border-radius: 0.5rem;
    background: var(--panel-2);
    color: var(--text);
    font-size: 1.3rem;
    box-sizing: border-box;

    &::placeholder {
      color: var(--muted);
    }

    &:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 0.2rem var(--accent-soft);
    }

    &.input-sm {
      padding: 0.5rem 0.8rem;
      font-size: 1.2rem;
    }
  }

  .btn {
    padding: 0.6rem 1.4rem;
    border-radius: 0.5rem;
    border: none;
    font-size: 1.3rem;
    cursor: pointer;

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    &.btn-small {
      padding: 0.3rem 0.9rem;
      font-size: 1.1rem;
    }

    &.btn-ghost {
      background: transparent;
      color: var(--muted);

      &:hover {
        background: var(--panel-2);
        color: var(--text);
      }
    }

    &.btn-primary {
      background: var(--accent);
      color: #fff;

      &:hover:not(:disabled) {
        filter: brightness(1.1);
      }
    }
  }

  .spacer {
    flex: 1;
  }
}
</style>
