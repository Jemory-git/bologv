<script setup lang="ts">
  /**
   * 插槽清单：数据直接来自 SLOT_CATALOG（各插槽定义处的 meta 聚合）。
   * 只读展示 —— 形态、归属（外置可用 / 仅内置）、实时占用数与注册方式。
   */
  import type { SlotKind, SlotMeta } from '@ui/slots'
  import { SLOT_CATALOG } from '@ui/slots'

  //states
  const KIND_LABELS: Record<SlotKind, string> = {
    list: '列表',
    pair: '配对',
    exclusive: '单槽',
  }

  const ACCESS_LABELS: Record<SlotMeta['access'], string> = {
    external: '外置可用',
    'builtin-only': '仅内置',
  }
</script>

<template>
  <ul class="slot-list">
    <li v-for="item in SLOT_CATALOG" :key="item.meta.id" class="slot-item">
      <header class="slot-head">
        <code class="slot-id">{{ item.meta.id }}</code>
        <span class="badge">{{ KIND_LABELS[item.meta.kind] }}</span>
        <span class="access" :class="item.meta.access">{{ ACCESS_LABELS[item.meta.access] }}</span>
        <span class="slot-count" :title="`当前已注册 ${item.count} 个条目`">{{ item.count }}</span>
      </header>
      <p class="slot-desc">
        <span class="slot-name">{{ item.meta.label }}</span>{{ item.meta.description }}
      </p>
      <code class="slot-usage">{{ item.meta.usage }}</code>
    </li>
  </ul>
</template>

<style scoped lang="scss">
.slot-list {
  margin: 0;
  padding: 0;
  border: 0.1rem solid var(--line);
  border-radius: 0.6rem;
  background: var(--panel);
  list-style: none;
  overflow: hidden;

  .slot-item {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1.2rem 1.6rem;

    &+& {
      border-top: 0.1rem solid var(--line);
    }
  }

  .slot-head {
    display: flex;
    flex-wrap: wrap;
    gap: 0.8rem;
    align-items: center;
  }

  .slot-id {
    color: var(--accent);
    font: 1.2rem var(--mono);
  }

  .badge {
    padding: 0 0.5rem;
    border: 0.1rem solid var(--line);
    border-radius: 0.3rem;
    color: var(--muted);
    font: 1rem var(--mono);
  }

  .access {
    display: inline-flex;
    gap: 0.5rem;
    align-items: center;
    font-size: 1.1rem;

    &::before {
      content: '';
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 50%;
      background: currentColor;
    }

    &.external {
      color: var(--ok);
    }

    &.builtin-only {
      color: var(--muted);
    }
  }

  .slot-count {
    margin-left: auto;
    color: var(--muted);
    font: 1rem var(--mono);

    &::after {
      content: ' 条';
    }
  }

  .slot-desc {
    margin: 0;
    color: var(--muted);
    font-size: 1.2rem;
    line-height: 1.7;

    .slot-name {
      margin-right: 0.8rem;
      color: var(--text);
      font-weight: 600;
    }
  }

  .slot-usage {
    color: var(--text);
    font: 1.1rem var(--mono);
    word-break: break-all;
  }
}
</style>
