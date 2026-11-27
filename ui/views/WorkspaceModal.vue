<script setup lang="ts">
  /**
   * 工作目录配置：选择目录并保存，重启应用后生效。
   *
   * 分工：路径选择走 IPC（系统目录框），持久化走 HTTP（settings 接口），
   * 与「IPC 只做 Electron 能力、HTTP 只做业务数据」的整体约定一致。
   * 工作目录同时是 fs 沙箱根、shell 执行目录与模型可见路径，所以不在运行时热切换。
   */

  // ———————————— imports ————————————

  import { computed, onMounted, ref } from 'vue'
  import { getWorkspace, setWorkspace } from '@ui/http/setting.ts'
  import { BRIDGE_SERVICE, type BridgeService } from '@ui/plugins/core/electron-bridge.ts'
  import { useService } from '@ui/use'

  // ============================================================================
  // states
  // ============================================================================

  const bridge = useService<BridgeService>(BRIDGE_SERVICE)

  /** 编辑中的路径；保存成功后与 savedDir 同步。 */
  const workingDir = ref('')
  /** 服务端当前生效的路径，用于判断是否有未保存改动。 */
  const savedDir = ref('')

  const loading = ref(true)
  const saving = ref(false)
  const error = ref<string | null>(null)
  const notice = ref<string | null>(null)

  const dirty = computed(() => workingDir.value.trim() !== savedDir.value)
  const busy = computed(() => loading.value || saving.value)

  // ============================================================================
  // methods
  // ============================================================================

  async function load(): Promise<void> {
    const [err, body] = await getWorkspace()
    loading.value = false
    if (err !== null || body.code !== 0) {
      error.value = body.msg || '获取工作目录失败'
      return
    }
    workingDir.value = body.data?.workingDir ?? ''
    savedDir.value = workingDir.value
  }

  async function pick(): Promise<void> {
    error.value = null
    notice.value = null
    const picked = await bridge.pickDirectory('选择工作目录')
    if (picked !== null) workingDir.value = picked
  }

  async function save(): Promise<void> {
    saving.value = true
    error.value = null
    notice.value = null

    const [err, body] = await setWorkspace({ workingDir: workingDir.value.trim() })
    saving.value = false

    if (err !== null || body.code !== 0) {
      error.value = body.msg || '保存失败'
      return
    }
    savedDir.value = body.data?.workingDir ?? workingDir.value
    workingDir.value = savedDir.value
    notice.value = '已保存，重启应用后生效'
  }

  // ============================================================================
  // hooks
  // ============================================================================

  onMounted(() => {
    void load()
  })
</script>

<template>
  <div class="workspace-modal">
    <div class="field">
      <label class="label" for="workspace-path">工作目录</label>

      <div class="path-row">
        <input
          id="workspace-path"
          v-model="workingDir"
          class="input"
          type="text"
          spellcheck="false"
          placeholder="选择或输入绝对路径"
          :disabled="busy"
        />
        <button type="button" class="btn btn-ghost" :disabled="busy" @click="pick">选择目录</button>
      </div>

      <p class="hint">文件工具的读写沙箱、shell 的执行目录、模型看到的工作目录都以它为根；工作目录之外只能按绝对路径读取。</p>
      <p class="hint">修改后需重启应用生效。</p>
    </div>

    <footer class="form-actions">
      <p v-if="error" class="form-error">{{ error }}</p>
      <p v-else-if="notice" class="form-notice">{{ notice }}</p>
      <span class="spacer" />
      <button type="button" class="btn btn-primary" :disabled="busy || !dirty" @click="save">
        {{ saving ? '保存中…' : '保存' }}
      </button>
    </footer>
  </div>
</template>

<style scoped lang="scss">
.workspace-modal {
  display: flex;
  flex-direction: column;
  gap: 1.6rem;

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;

    .label {
      font-size: 1.2rem;
      color: var(--muted);
    }

    .path-row {
      display: flex;
      gap: 0.8rem;
    }

    .input {
      flex: 1;
      min-width: 0;
      padding: 0.6rem 0.9rem;
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
    }

    .hint {
      margin: 0;
      font-size: 1.2rem;
      line-height: 1.6;
      color: var(--muted);
    }
  }

  .form-actions {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    padding-top: 1.2rem;
    border-top: 0.1rem solid var(--line);

    .form-error {
      margin: 0;
      font-size: 1.2rem;
      color: var(--fail);
    }

    .form-notice {
      margin: 0;
      font-size: 1.2rem;
      color: var(--ok);
    }
  }

  .spacer {
    flex: 1;
  }

  .btn {
    padding: 0.6rem 1.4rem;
    border: none;
    border-radius: 0.5rem;
    font-size: 1.3rem;
    cursor: pointer;
    flex-shrink: 0;

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    &.btn-ghost {
      background: transparent;
      color: var(--muted);

      &:hover:not(:disabled) {
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
}
</style>
