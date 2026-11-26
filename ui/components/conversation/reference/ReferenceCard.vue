<script setup lang="ts">
/**
 * 参考文件卡片：文件名在上、图标在下。
 *
 * 结构性约束：
 *   - 「打开预览」与「移除」是两个并列按钮，不互相嵌套，键盘与读屏语义清晰；
 *   - 删除按钮只在 hover / focus 时出现，避免每张卡片常驻一个叉；
 *   - 图标区域是放大镜光标，明确表达「可查看」。
 */
import { computed } from 'vue'
import { BRIDGE_SERVICE } from '@ui/plugins/core/electron-bridge.ts'
import { useService } from '@ui/use'
import { referenceIcon } from './reference-icon.ts'
import type { BridgeService } from '@ui/plugins/core/electron-bridge.ts'
import type { ReferenceMeta } from '@pkg/session/references.ts'

//states
const props = withDefaults(
  defineProps<{
    reference: ReferenceMeta
    /** 与模型可见标记同源的短标识，如「图片 1」。 */
    label: string
    removable?: boolean
  }>(),
  { removable: false },
)

const bridge = useService<BridgeService>(BRIDGE_SERVICE)
const icon = computed(() => referenceIcon(props.reference.name, props.reference.kind))
const hint = computed(
  () => `${props.reference.path}\n${formatSize(props.reference.size)}`,
)

//methods
function formatSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

/**
 * 预览是应用级只读能力：卡片自己调用即可，父组件只关心列表增删，
 * 不必为同一个动作在输入框和历史消息里各转发一次事件。
 */
function onPreview(): void {
  void bridge.previewReference({ ...props.reference })
}

function onRemove(): void {
  emit('remove')
}

//events
const emit = defineEmits<{ remove: [] }>()
</script>

<template>
  <div class="ref-card">
    <button type="button" class="ref-open" :title="hint" :aria-label="`预览 ${label}：${reference.name}`"
      @click="onPreview">
      <span class="ref-name">{{ reference.name }}</span>
      <span class="ref-view">
        <component :is="icon" class="ref-icon" aria-hidden="true" />
        <span class="ref-label">{{ label }}</span>
      </span>
    </button>
    <button v-if="removable" type="button" class="ref-remove" :aria-label="`移除 ${reference.name}`" @click="onRemove">
      ×
    </button>
  </div>
</template>

<style scoped lang="scss">
.ref-card {
  position: relative;
  flex: none;
  width: 6.4rem;
  height: 7.2rem;
}

.ref-open {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  width: 100%;
  height: 100%;
  padding: 0.5rem;
  border: 0.1rem solid var(--line);
  border-radius: 0.9rem;
  background: var(--panel-2);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.14s,
    background 0.14s,
    transform 0.14s;

  &:hover {
    border-color: var(--accent-line);
    background: color-mix(in srgb, var(--accent) 6%, var(--panel-2));
    transform: translateY(-0.1rem);
  }
}

.ref-name {
  display: -webkit-box;
  overflow: hidden;
  color: var(--text);
  font-size: 1rem;
  line-height: 1.25;
  word-break: break-all;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.ref-view {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  min-height: 0;
  cursor: zoom-in;
}

.ref-icon {
  width: 2rem;
  height: 2rem;
  color: var(--accent);
}

.ref-label {
  color: var(--muted);
  font: 0.9rem var(--mono);
}

.ref-remove {
  position: absolute;
  top: 0.1rem;
  right: 0.1rem;
  z-index: 1;
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 0.4rem;
  background: var(--panel);
  color: var(--muted);
  font-size: 1.2rem;
  line-height: 1;
  opacity: 0;
  transition: opacity 0.12s;

  .ref-card:hover &,
  .ref-card:focus-within & {
    opacity: 1;
  }

  &:hover {
    color: var(--fail);
  }
}
</style>
