<script setup lang="ts">
/**
 * 对话输入区：固定在 chat-view 底部。
 *
 * 左侧是 ListSlot "chat.composer.actions"（放上传、模板等快捷按钮），
 * 中间是 textarea，右侧是发送按钮。pending 期间发送禁用。
 */
import { ref } from 'vue'
import SlotOutlet from '@ui/components/slots/SlotOutlet.vue'
import { chatComposerActions } from '@ui/slots/list/chat-composer-actions.ts'

const props = defineProps<{ pending: boolean }>()
const emit = defineEmits<{ send: [text: string] }>()

const text = ref('')

function onSubmit(): void {
  const trimmed = text.value.trim()
  if (trimmed === '' || props.pending) return
  emit('send', trimmed)
  text.value = ''
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    onSubmit()
  }
}
</script>

<template>
  <footer class="composer">
    <SlotOutlet :slot="chatComposerActions" />
    <textarea
      v-model="text"
      class="input"
      rows="1"
      placeholder="输入消息… (Enter 发送, Shift+Enter 换行)"
      :disabled="pending"
      @keydown="onKeydown"
    />
    <button type="button" class="send" :disabled="pending || !text.trim()" @click="onSubmit">
      发送
    </button>
  </footer>
</template>

<style scoped lang="scss">
.composer {
  display: flex;
  align-items: flex-end;
  gap: 0.8rem;
  padding: 1rem 1.6rem;
  border-top: 0.1rem solid var(--line);
  background: var(--panel);
}

.input {
  flex: 1;
  resize: none;
  padding: 0.7rem 1rem;
  border: 0.1rem solid var(--line);
  border-radius: 0.8rem;
  background: var(--panel-2);
  color: var(--text);
  font-size: 1.4rem;
  line-height: 1.5;

  &:focus {
    outline: none;
    border-color: var(--accent-line);
  }

  &:disabled {
    opacity: 0.5;
  }
}

.send {
  padding: 0.7rem 1.4rem;
  border: 0.1rem solid var(--line);
  border-radius: 0.8rem;
  background: var(--accent);
  color: #08111d;
  font: 600 1.3rem var(--mono);
  cursor: pointer;

  &:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}
</style>
