<script setup lang="ts">
  /**
   * 对话标题栏：会话名、模型标识与操作区。
   */
  import ListSlotOutlet from '@ui/components/slots/ListSlotOutlet.vue'
  import { chatHeaderActions } from '@ui/slots'

  defineProps<{ title: string; model: string; }>()

</script>

<template>
  <header class="chat-header">
    <div class="thread">
      <h1>{{ title }}</h1>
      <span class="badge">{{ model }}</span>
    </div>
    <div class="actions">
      <ListSlotOutlet :slot="chatHeaderActions" reverse />
    </div>
  </header>
</template>

<style scoped lang="scss">
.chat-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.6rem;
  padding: 1.2rem 2rem;
  border-bottom: 0.1rem solid var(--line);
  background: color-mix(in srgb, var(--panel) 60%, transparent);
}

.thread {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  min-width: 0;
}

h1 {
  margin: 0;
  overflow: hidden;
  font-size: 1.5rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge {
  padding: 0.1rem 0.8rem;
  border: 0.1rem solid var(--line);
  border-radius: 99.9rem;
  color: var(--muted);
  font: 1.1rem var(--mono);
}

.actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 0.8rem;
}

.actions button {
  padding: 0.5rem 1rem;
  border: 0.1rem solid var(--line);
  border-radius: 0.7rem;
  background: transparent;
  color: var(--muted);
  font-size: 1.2rem;
}

.actions button:hover:not(:disabled) {
  background: var(--panel-2);
  color: var(--text);
}

.actions button:disabled {
  opacity: 0.45;
}
</style>
