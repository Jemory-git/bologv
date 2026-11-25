<script setup lang="ts">
/**
 * 对话输入区：固定在 chat-view 底部。
 *
 * 参考文件不复制：通过系统文件框取得绝对路径，服务端只读取元信息。
 * 列表平铺展示，不按类型分组；类型只用于服务端处理路径。
 * 徽标显示「类别 + 同类序号」，与模型可见的引用标记同源。
 */
import { computed, ref } from 'vue'
import IconArrowUp from '~icons/icon-park-outline/arrow-up'
import IconPaperclip from '~icons/icon-park-outline/paperclip'
import { referenceLabels } from '@pkg/session/types.ts'
import ListSlotOutlet from '@ui/components/slots/ListSlotOutlet.vue'
import { inspectReferences } from '@ui/http/references.ts'
import { BRIDGE_SERVICE } from '@ui/plugins/core/electron-bridge.ts'
import { chatComposerActions } from '@ui/slots'
import { useService } from '@ui/use'
import ReferenceCard from './reference/ReferenceCard.vue'
import type { BridgeService } from '@ui/plugins/core/electron-bridge.ts'
import type { ReferenceMeta } from '@pkg/session/types.ts'

interface ComposerPayload {
  text: string
  referencePaths: string[]
}

//states
const props = defineProps<{ pending: boolean }>()
const bridge = useService<BridgeService>(BRIDGE_SERVICE)
const text = ref('')
const references = ref<ReferenceMeta[]>([])
const error = ref('')
const inspecting = ref(false)

/** 与投影时模型看到的「图片 1」一一对应。 */
const labels = computed(() => referenceLabels(references.value))
const busy = computed(() => props.pending || inspecting.value)
const canSend = computed(
  () =>
    !busy.value &&
    (text.value.trim() !== '' || references.value.length > 0),
)

//methods
async function addReferences(): Promise<void> {
  const paths = await bridge.pickReferences()
  if (paths.length === 0) return

  error.value = ''
  inspecting.value = true
  const [, body] = await inspectReferences(paths)
  inspecting.value = false

  const result = body.data
  if (body.code !== 0 || result === undefined) {
    error.value = `检查参考文件失败：${body.msg || 'unknown error'}`
    return
  }

  references.value = mergeReferences(references.value, result.references)
  if (result.errors.length > 0) {
    error.value = result.errors.map((item) => item.message).join('；')
  }
}

function mergeReferences(
  current: readonly ReferenceMeta[],
  incoming: readonly ReferenceMeta[],
): ReferenceMeta[] {
  const seen = new Set(current.map((item) => item.path))
  const next = [...current]
  for (const reference of incoming) {
    if (seen.has(reference.path)) continue
    seen.add(reference.path)
    next.push(reference)
  }
  return next
}

function removeReference(target: ReferenceMeta): void {
  references.value = references.value.filter((item) => item.path !== target.path)
}

function onSubmit(): void {
  if (!canSend.value) return
  emit('send', {
    text: text.value.trim(),
    referencePaths: references.value.map((item) => item.path),
  })
  text.value = ''
  references.value = []
  error.value = ''
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    onSubmit()
  }
}

//events
const emit = defineEmits<{ send: [payload: ComposerPayload] }>()
</script>

<template>
  <footer class="composer">
    <div class="composer-card">
      <div v-if="references.length > 0" class="refs">
        <ReferenceCard v-for="(reference, index) in references" :key="reference.path" :reference="reference"
          :label="labels[index] ?? ''" removable @remove="removeReference(reference)" />
      </div>

      <textarea v-model="text" class="composer-input thin-bar" rows="1" placeholder="说点什么…" :disabled="pending"
        @keydown="onKeydown" />

      <div class="composer-bar">
        <div class="composer-tools">
          <button type="button" class="tool" :disabled="busy" title="添加参考文件" aria-label="添加参考文件" @click="addReferences">
            <IconPaperclip class="tool-icon" aria-hidden="true" />
          </button>
          <ListSlotOutlet :slot="chatComposerActions" reverse />
        </div>

        <button type="button" class="send" :disabled="!canSend" title="发送" aria-label="发送" @click="onSubmit">
          <IconArrowUp class="send-icon" aria-hidden="true" />
        </button>
      </div>
    </div>

    <p v-if="inspecting" class="composer-note">正在检查参考文件…</p>
    <p v-else-if="error !== ''" class="composer-note error">{{ error }}</p>
    <p v-else class="composer-note">Enter 发送 · Shift + Enter 换行</p>
  </footer>
</template>

<style scoped lang="scss">
.composer {
  width: 80%;
  max-width: 130rem;
  padding: 0.8rem 2.4rem 2.4rem;
  background: transparent;
}

.composer-card {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 1rem 1.2rem;
  border: 0.1rem solid var(--line);
  border-radius: 1.6rem;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.025), transparent 45%),
    var(--panel);
  box-shadow: 0 1.6rem 4rem rgba(0, 0, 0, 0.32);
  transition:
    border-color 0.16s,
    box-shadow 0.16s;

  &:focus-within {
    border-color: var(--accent-line);
    box-shadow:
      0 1.6rem 4rem rgba(0, 0, 0, 0.38),
      0 0 3.2rem rgba(110, 168, 254, 0.1);
  }
}

.refs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  padding: 0.2rem 0.2rem 0.9rem;
  border-bottom: 0.1rem solid var(--line);
}

.composer-input {
  width: 100%;
  // height: 10rem;
  min-height: 10rem;
  max-height: 20rem;
  padding: 0.8rem 0.6rem;
  overflow-y: auto;
  border: 0;
  background: transparent;
  color: var(--text);
  font-size: 1.45rem;
  line-height: 1.6;
  resize: none;
  field-sizing: content;

  &::placeholder {
    color: var(--muted);
  }

  &:focus {
    outline: none;
  }

  &:disabled {
    opacity: 0.5;
  }
}

.composer-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
}

.composer-tools {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.tool {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3.4rem;
  height: 3.4rem;
  border: 0;
  border-radius: 0.9rem;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition:
    background 0.14s,
    color 0.14s;

  &:hover:not(:disabled) {
    background: var(--panel-2);
    color: var(--text);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.tool-icon {
  width: 1.8rem;
  height: 1.8rem;
}

.send {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3.6rem;
  height: 3.6rem;
  border: 0;
  border-radius: 50%;
  background: linear-gradient(140deg, #8ab8ff, #5a95ff);
  color: #08111d;
  cursor: pointer;
  box-shadow: 0 0.4rem 1.4rem rgba(90, 149, 255, 0.28);
  transition:
    transform 0.14s,
    box-shadow 0.14s,
    background 0.14s;

  &:hover:not(:disabled) {
    transform: translateY(-0.1rem);
    box-shadow: 0 0.6rem 1.8rem rgba(90, 149, 255, 0.4);
  }

  &:disabled {
    background: var(--panel-2);
    color: var(--muted);
    box-shadow: none;
    cursor: not-allowed;
  }
}

.send-icon {
  width: 1.8rem;
  height: 1.8rem;
}

.composer-note {
  margin: 0.8rem 0 0;
  padding-left: 0.4rem;
  color: var(--muted);
  font-size: 1.1rem;

  &.error {
    color: var(--fail);
  }
}
</style>
