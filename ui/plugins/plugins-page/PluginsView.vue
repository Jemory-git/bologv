<script setup lang="ts">
/**
 * 插件页：显示完整清单（固定 + 可切换），可切换的提供启停开关。
 *
 * 固定插件 = 基础架构（渲染器、连接层、设置页……），在 main.ts 直接 use，
 * registry 只标记它们 active 不插手加载/卸载。
 * 可切换插件 = 由 registry 按 localStorage / defaultEnabled 启停。
 */
import { shallowReactive } from 'vue'
import { PLUGIN_REGISTRY_SERVICE, type PluginRegistryService } from '@ui/plugins/core/plugin-registry.ts'
import { useService } from '@ui/use/ctx-service.ts'

const registry = useService<PluginRegistryService>(PLUGIN_REGISTRY_SERVICE)

const toggling = shallowReactive(new Set<string>())

async function handleToggle(id: string): Promise<void> {
  if (toggling.has(id)) return
  toggling.add(id)
  try {
    await registry.toggle(id)
  } finally {
    toggling.delete(id)
  }
}
</script>

<template>
  <section class="panel-page">
    <header class="page-header">
      <h1>插件</h1>
      <span class="count">{{ registry.activeIds.size }} / {{ registry.all.length }}</span>
    </header>
    <p class="lede">启用的插件会向侧边栏和主区域注册入口；停用后自动移除所有视图和监听。</p>
    <ul class="plugin-list">
      <li v-for="meta in registry.all" :key="meta.id" class="plugin-item">
        <div class="plugin-info">
          <div class="plugin-label">
            {{ meta.label }}
            <span v-if="meta.fixed" class="tag tag-fixed">固定</span>
          </div>
          <div v-if="meta.description" class="plugin-desc">{{ meta.description }}</div>
          <div class="plugin-id">{{ meta.id }}</div>
        </div>
        <!-- 可切换插件：显示启停开关 -->
        <button v-if="!meta.fixed" type="button" class="toggle"
          :class="{ 'toggle-on': registry.isEnabled(meta.id), 'toggle-off': !registry.isEnabled(meta.id) }"
          :disabled="toggling.has(meta.id)" @click="handleToggle(meta.id)">
          <template v-if="toggling.has(meta.id)">切换中…</template>
          <template v-else-if="registry.isEnabled(meta.id)">已启用</template>
          <template v-else>已停用</template>
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped lang="scss">
.panel-page {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 1.4rem;
  min-height: 0;
  padding: 2.4rem 2.8rem;
  overflow-y: auto;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 1rem;
}

h1 {
  margin: 0;
  font-size: 1.8rem;
  font-weight: 600;
}

.count {
  padding: 0 0.8rem;
  border-radius: 99.9rem;
  background: var(--panel-2);
  color: var(--muted);
  font: 1.1rem var(--mono);
}

.lede {
  margin: 0;
  color: var(--muted);
  font-size: 1.3rem;
}

.plugin-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.plugin-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.6rem;
  padding: 1.2rem 1.4rem;
  border: 0.1rem solid var(--line);
  border-radius: 0.8rem;
  background: var(--panel);
}

.plugin-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.plugin-label {
  font-size: 1.4rem;
  font-weight: 600;

  .tag {
    margin-left: 0.6rem;
    padding: 0.1rem 0.6rem;
    border-radius: 99.9rem;
    font: 1rem var(--mono);
  }

  .tag-fixed {
    background: var(--panel-2);
    color: var(--muted);
  }
}

.plugin-desc {
  color: var(--muted);
  font-size: 1.2rem;
}

.plugin-id {
  font: 1rem var(--mono);
  color: var(--muted);
}

.toggle {
  flex-shrink: 0;
  padding: 0.4rem 1.2rem;
  border-radius: 0.6rem;
  border: 0.1rem solid var(--line);
  background: transparent;
  font-size: 1.2rem;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;

  &:disabled {
    cursor: default;
  }
}

.toggle-fixed {
  color: var(--muted);
  border-color: var(--line);
}

.toggle-on {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;

  &:hover:not(:disabled) {
    opacity: 0.9;
  }
}

.toggle-off {
  color: var(--muted);

  &:hover:not(:disabled) {
    border-color: var(--accent);
    color: var(--accent);
  }
}
</style>
