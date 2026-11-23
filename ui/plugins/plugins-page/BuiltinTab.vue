<script setup lang="ts">
/**
 * 内置插件视图：编译期静态插件，固定项不可关闭。
 * 启停细节全部委托给 registry，本组件只负责筛选与传参。
 */
import type { PluginRegistryService } from '@ui/plugins/core/plugin-registry.ts'
import { computed } from 'vue'
import { PLUGIN_REGISTRY_SERVICE } from '@ui/plugins/core/plugin-registry.ts'
import { useService } from '@ui/use/ctx-service.ts'
import PluginRow from './PluginRow.vue'
import { usePluginActions } from './use-plugin-actions.ts'

//states
const registry = useService<PluginRegistryService>(PLUGIN_REGISTRY_SERVICE)
const { busy, toggle } = usePluginActions()

const plugins = computed(() => registry.all.filter((meta) => meta.origin === 'builtin'))
</script>

<template>
  <ul class="plugin-list">
    <PluginRow v-for="meta in plugins" :key="meta.id" :meta="meta"
      :enabled="registry.isEnabled(meta.id)" :busy="busy.has(meta.id)"
      :error="registry.loadErrors.get(meta.id)" @toggle="toggle(meta.id)" />
  </ul>
</template>

<style scoped lang="scss">
.plugin-list {
  margin: 0;
  padding: 0;
  border: 0.1rem solid var(--line);
  border-radius: 0.6rem;
  background: var(--panel);
  list-style: none;
  overflow: hidden;
}
</style>
