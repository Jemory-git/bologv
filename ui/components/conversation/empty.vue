<script setup lang="ts">
/**
 * 空会话引导：给出可以直接点击发送的示例。
 */
const emit = defineEmits<{ suggest: [text: string] }>()

const suggestions = ['读取 package.json', '现在几点了', '你好'] as const
</script>

<template>
  <div class="chat-empty">
    <span class="mark" aria-hidden="true">d</span>
    <h2>开始一段对话</h2>
    <p>当前使用 mock 模型，不会联网。可以试试：</p>
    <div class="suggestions">
      <button
        v-for="suggestion in suggestions"
        :key="suggestion"
        type="button"
        @click="emit('suggest', suggestion)"
      >
        {{ suggestion }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.chat-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.8rem;
  margin: auto;
  padding: 4rem 2rem;
  text-align: center;
}

.mark {
  display: grid;
  place-items: center;
  width: 3.6rem;
  height: 3.6rem;
  border-radius: 1.2rem;
  background: var(--accent);
  color: #08111d;
  font: 700 1.6rem var(--mono);
}

h2 {
  margin: 0.4rem 0 0;
  font-size: 1.6rem;
  font-weight: 600;
}

p {
  margin: 0;
  color: var(--muted);
  font-size: 1.2rem;
}

.suggestions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.6rem;
  margin-top: 0.6rem;
}

.suggestions button {
  padding: 0.6rem 1rem;
  border: 0.1rem solid var(--line);
  border-radius: 99.9rem;
  background: var(--panel);
  color: var(--text);
  font-size: 1.2rem;
}

.suggestions button:hover {
  border-color: var(--accent-line);
  background: var(--accent-soft);
}
</style>
