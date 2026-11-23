<script setup lang="ts">
/**
 * 插件页：按「内置 / 外置 / 开发者」三个视图切换显示。
 * 头部只呈现整体装配状态；各视图的内容与交互在对应 Tab 组件里。
 */
import type { PluginRegistryService } from '@ui/plugins/core/plugin-registry.ts'
import { computed, ref } from 'vue'
import { PLUGIN_REGISTRY_SERVICE } from '@ui/plugins/core/plugin-registry.ts'
import { useService } from '@ui/use/ctx-service.ts'
import BuiltinTab from './BuiltinTab.vue'
import DeveloperTab from './DeveloperTab.vue'
import ExternalTab from './ExternalTab.vue'

//states
type TabId = 'builtin' | 'external' | 'developer'

const registry = useService<PluginRegistryService>(PLUGIN_REGISTRY_SERVICE)
const activeTab = ref<TabId>('external')

const builtinCount = computed(() => registry.all.filter((meta) => meta.origin === 'builtin').length)
const externalCount = computed(() => registry.all.filter((meta) => meta.origin === 'external').length)

const tabs = computed<{ id: TabId; label: string; count?: number }[]>(() => [
  { id: 'external', label: '外置插件', count: externalCount.value },
  { id: 'builtin', label: '内置插件', count: builtinCount.value },
  { id: 'developer', label: '开发者' },
])
</script>

<template>
  <section class="panel-page">
    <header class="masthead">
      <div class="identity">
        <h1>插件</h1>
        <p class="lede">内置插件随应用编译；外置插件从用户目录运行时加载，启停即插即拔。</p>
      </div>
      <div class="stats">
        <span class="stat-value">{{ registry.activeIds.size }}<i>/</i>{{ registry.all.length }}</span>
        <span class="stat-label">已启用 / 总数</span>
      </div>
    </header>

    <nav class="tabs">
      <button v-for="tab in tabs" :key="tab.id" type="button" class="tab" :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id">
        <span class="tab-label">{{ tab.label }}</span>
        <span v-if="tab.count !== undefined" class="tab-count">{{ tab.count }}</span>
      </button>
    </nav>

    <div class="tab-body">
      <BuiltinTab v-if="activeTab === 'builtin'" />
      <ExternalTab v-else-if="activeTab === 'external'" />
      <DeveloperTab v-else />
    </div>
  </section>
</template>

<style scoped lang="scss">
.panel-page {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  padding: 2.8rem 3.2rem 4rem;
  overflow-y: auto;
  scrollbar-color: rgba(255, 255, 255, 0.12) transparent;
  scrollbar-width: thin;

  .masthead {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 2.4rem;

    .identity {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      min-width: 0;
    }

    h1 {
      margin: 0;
      font-size: 2rem;
      font-weight: 600;
      letter-spacing: -0.01em;
      line-height: 1.1;
    }

    .lede {
      max-width: 52rem;
      margin: 0;
      color: var(--muted);
      font-size: 1.2rem;
      line-height: 1.7;
    }

    .stats {
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      align-items: flex-end;
      gap: 0.3rem;
    }

    .stat-value {
      color: var(--text);
      font: 500 1.9rem/1 var(--mono);
      letter-spacing: 0.02em;

      i {
        margin: 0 0.3rem;
        color: var(--line);
        font-style: normal;
      }
    }

    .stat-label {
      color: var(--muted);
      font-size: 1rem;
      letter-spacing: 0.08em;
    }
  }

  .tabs {
    display: flex;
    gap: 2.8rem;
    margin-top: 2.4rem;
    border-bottom: 0.1rem solid var(--line);

    .tab {
      position: relative;
      display: flex;
      align-items: baseline;
      gap: 0.6rem;
      padding: 0 0.1rem 1.2rem;
      border: none;
      background: transparent;
      color: var(--muted);
      font-size: 1.3rem;
      cursor: pointer;
      transition: color 0.15s;

      &::after {
        content: '';
        position: absolute;
        inset: auto 0 -0.1rem 0;
        height: 0.2rem;
        background: var(--accent);
        opacity: 0;
        transform: scaleX(0.4);
        transition: opacity 0.2s, transform 0.2s;
      }

      &:hover {
        color: var(--text);
      }

      &.active {
        color: var(--text);

        &::after {
          opacity: 1;
          transform: scaleX(1);
        }

        .tab-count {
          color: var(--accent);
        }
      }

      .tab-count {
        color: var(--muted);
        font: 1rem var(--mono);
        transition: color 0.15s;
      }
    }
  }

  .tab-body {
    padding-top: 2.2rem;
    animation: tab-in 0.22s ease both;
  }
}

@keyframes tab-in {
  from {
    opacity: 0;
    transform: translateY(0.6rem);
  }

  to {
    opacity: 1;
    transform: none;
  }
}
</style>
