<script setup lang="ts">
/**
 * 通用模态窗壳：全屏遮罩 + 居中卡片。
 * 负责：遮罩点击关闭、Esc 关闭、关闭按钮。
 * 具体内容通过默认 slot 传入。
 */
import { computed, onMounted, onUnmounted } from 'vue'

const props = withDefaults(
  defineProps<{
    /** 窗口标题，渲染在卡片头部。 */
    title: string
    /** 卡片宽度，CSS 值。默认 52rem。 */
    width?: string
    /** 卡片固定高度，CSS 值。不传则自适应内容。 */
    height?: string
  }>(),
  { width: '52rem' },
)

const emit = defineEmits<{
  /** 请求关闭：遮罩点击 / Esc / 关闭按钮都会触发。 */
  (e: 'close'): void
}>()

function onOverlayClick(e: MouseEvent): void {
  if (e.target === e.currentTarget) emit('close')
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') emit('close')
}

const cardStyle = computed<Record<string, string>>(() => {
  const s: Record<string, string> = { width: props.width }
  if (props.height !== undefined) s.height = props.height
  return s
})

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="modal-overlay" role="dialog" aria-modal="true" @click="onOverlayClick">
    <div class="modal-card" :style="cardStyle">
      <header class="modal-header">
        <h2 class="modal-title">{{ title }}</h2>
        <button type="button" class="modal-close" aria-label="关闭" @click="emit('close')">✕</button>
      </header>
      <div class="modal-body">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
}

.modal-card {
  max-height: 90vh;
  max-width: 95vw;
  display: flex;
  flex-direction: column;
  border: 0.1rem solid var(--line);
  border-radius: 1.2rem;
  background: var(--panel);
  box-shadow: 0 1.6rem 4.8rem rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  padding: 1.6rem 2rem;
  border-bottom: 0.1rem solid var(--line);
}

.modal-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text);
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.8rem;
  height: 2.8rem;
  border: none;
  border-radius: 0.6rem;
  background: transparent;
  color: var(--muted);
  font-size: 1.2rem;
  cursor: pointer;

  &:hover {
    background: var(--panel-2);
    color: var(--text);
  }
}

.modal-body {
  flex: 1;
  min-height: 0;
  padding: 2rem;
  overflow: hidden;
}
</style>
