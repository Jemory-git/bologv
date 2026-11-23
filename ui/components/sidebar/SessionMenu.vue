<script setup lang="ts">
  /**
   * 会话右键菜单：定位到鼠标位置，只有一个「重命名」动作。
   *
   * - 点击菜单外 / Escape 关闭（父组件收 close）
   * - 位置在视口边缘自动收进，避免菜单溢出
   */
  import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

  const props = defineProps<{ x: number; y: number }>()
  const emit = defineEmits<{
    (e: 'rename'): void
    (e: 'delete'): void
    (e: 'close'): void
  }>()

  //states
  const menu = ref<HTMLElement | null>(null)
  /** 删除需要二次确认：第一次点击只切换文案，第二次才真正删除。 */
  const confirming = ref(false)
  const style = computed(() => ({
    left: `${Math.min(props.x, window.innerWidth - 160)}px`,
    top: `${Math.min(props.y, window.innerHeight - 56)}px`,
  }))

  //methods
  function onDelete(): void {
    if (!confirming.value) {
      confirming.value = true
      return
    }
    emit('delete')
    emit('close')
  }
  function onPointerDown(event: PointerEvent): void {
    const target = event.target as HTMLElement
    if (menu.value !== null && menu.value.contains(target)) return
    // 触发按钮自己负责开关：pointerdown 若先关闭，紧随的 click 会再次打开
    if (target.closest('[data-session-menu-trigger]') !== null) return
    emit('close')
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') emit('close')
  }

  //hooks
  onMounted(() => {
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('pointerdown', onPointerDown, true)
    window.removeEventListener('keydown', onKeyDown)
  })
</script>

<template>
  <Teleport to="body">
    <div ref="menu" class="session-menu" :style="style" role="menu">
      <button type="button" role="menuitem" @click="emit('rename'); emit('close')">重命名</button>
      <button type="button" class="danger" role="menuitem" @click="onDelete">
        {{ confirming ? '确认删除？' : '删除会话' }}
      </button>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.session-menu {
  position: fixed;
  z-index: 200;
  min-width: 14rem;
  padding: 0.4rem;
  border: 0.1rem solid var(--line);
  border-radius: 0.8rem;
  background: var(--panel);
  box-shadow: 0 1.2rem 3rem rgb(0 0 0 / 35%);

  button {
    width: 100%;
    padding: 0.7rem 1rem;
    border: 0;
    border-radius: 0.6rem;
    background: transparent;
    color: var(--text);
    font-size: 1.2rem;
    text-align: left;
    cursor: pointer;

    &:hover {
      background: var(--panel-2);
    }

    &.danger {
      color: var(--fail);

      &:hover {
        background: rgb(240 115 106 / 12%);
      }
    }
  }
}
</style>
