<script setup lang="ts">
  /**
   * 顶部应用栏：窗口拖拽区、品牌、模型标识与插件扩展位。
   */
  import ListSlotOutlet from '@ui/components/slots/ListSlotOutlet.vue'
  import { appHeaderLeft, appHeaderRight } from '@ui/slots'

  defineProps<{ model: string }>()
</script>

<template>
  <div class="titlebar-content">
    <div class="header-half header-left">
      <span class="badge">{{ model }}</span>
      <div class="header-slot">
        <ListSlotOutlet :slot="appHeaderLeft" />
      </div>
    </div>
    <div class="header-half header-right">
      <div class="header-slot">
        <ListSlotOutlet :slot="appHeaderRight" reverse />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.titlebar-content {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: center;
  gap: 1.2rem;
  width: 100%;
  height: 100%;
  padding: 0 1.4rem;
  -webkit-app-region: drag;

  .header-half {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    min-width: 0;
  }

  .header-left {
    justify-content: flex-start;
  }

  .header-right {
    justify-content: flex-end;
  }

  .badge {
    flex: none;
    padding: 0.1rem 0.8rem;
    border: 0.1rem solid var(--line);
    border-radius: 99.9rem;
    color: var(--muted);
    font: 1.1rem var(--mono);
  }

  .header-slot {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    min-width: 0;
    -webkit-app-region: no-drag;
  }
}
</style>
