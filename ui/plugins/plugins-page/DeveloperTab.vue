<script setup lang="ts">
  /**
   * 开发者视图：外置插件的能力说明 + 宿主插槽清单。
   * 两块内容分别由 HostCapabilities（静态 ABI）与 SlotCatalog（运行时元信息）提供。
   */
  import { SLOT_CATALOG } from '@ui/slots'
  import HostCapabilities from './HostCapabilities.vue'
  import SlotCatalog from './SlotCatalog.vue'

  //states
  const slotCount = SLOT_CATALOG.length
</script>

<template>
  <div class="developer">
    <section class="block">
      <header class="block-header">
        <h2>宿主能力</h2>
        <span class="block-key">Host API</span>
      </header>
      <HostCapabilities />
    </section>

    <section class="block">
      <header class="block-header">
        <h2>插槽注册表</h2>
        <span class="block-key">Slots · {{ slotCount }}</span>
      </header>
      <p class="hint">
        外置插件目前只能写入 <code>sidebar.panels</code>；其余插槽仅内置插件可用，右边的占用数是实时值。
      </p>
      <SlotCatalog />
    </section>
  </div>
</template>

<style scoped lang="scss">
.developer {
  display: flex;
  flex-direction: column;
  gap: 3.2rem;

  .block {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .block-header {
    display: flex;
    align-items: baseline;
    gap: 1rem;
    padding-bottom: 0.8rem;
    border-bottom: 0.1rem solid var(--line);

    h2 {
      margin: 0;
      font-size: 1.4rem;
      font-weight: 600;
    }

    .block-key {
      margin-left: auto;
      color: var(--muted);
      font: 1rem var(--mono);
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
  }

  .hint {
    margin: 0;
    color: var(--muted);
    font-size: 1.2rem;
    line-height: 1.7;

    code {
      padding: 0.1rem 0.4rem;
      border-radius: 0.3rem;
      background: var(--panel-2);
      color: var(--accent);
      font-family: var(--mono);
      font-size: 1.1rem;
    }
  }
}
</style>
