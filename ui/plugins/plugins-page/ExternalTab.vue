<script setup lang="ts">
/**
 * 外置插件视图：userData/plugins 运行时发现，可启用 / 停用 / 重载 / 重新扫描。
 * 扫描结果、加载错误与目录问题都来自 registry，本组件只做展示与交互转发。
 */
import type { PluginRegistryService } from '@ui/plugins/core/plugin-registry.ts'
import { computed } from 'vue'
import { PLUGIN_REGISTRY_SERVICE } from '@ui/plugins/core/plugin-registry.ts'
import { useService } from '@ui/use/ctx-service.ts'
import PluginRow from './PluginRow.vue'
import { usePluginActions } from './use-plugin-actions.ts'

//states
const registry = useService<PluginRegistryService>(PLUGIN_REGISTRY_SERVICE)
const { busy, toggle, reload } = usePluginActions()

const plugins = computed(() => registry.all.filter((meta) => meta.origin === 'external'))
</script>

<template>
  <div class="external">
    <div class="toolbar">
      <span class="toolbar-key">Dir</span>
      <code class="dir" :title="registry.externalDir">{{ registry.externalDir || '尚未确定' }}</code>
      <button type="button" class="rescan" :disabled="registry.scanning" @click="registry.rescan()">
        {{ registry.scanning ? '扫描中…' : '重新扫描' }}
      </button>
    </div>

    <ul v-if="plugins.length > 0" class="plugin-list">
      <PluginRow v-for="meta in plugins" :key="meta.id" :meta="meta"
        :enabled="registry.isEnabled(meta.id)" :busy="busy.has(meta.id)"
        :error="registry.loadErrors.get(meta.id)" @toggle="toggle(meta.id)" @reload="reload(meta.id)" />
    </ul>
    <p v-else class="empty">
      未发现外置插件。把包含 <code>manifest.json</code> 与 <code>main.js</code> 的目录放进上面的目录，再点「重新扫描」。
    </p>

    <ul v-if="registry.issues.length > 0" class="issue-list">
      <li v-for="issue in registry.issues" :key="issue.dir">
        <code>{{ issue.dir }}</code>：{{ issue.reason }}
      </li>
    </ul>
  </div>
</template>

<style scoped lang="scss">
.external {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;

  .toolbar {
    display: flex;
    align-items: center;
    gap: 1.2rem;

    .toolbar-key {
      color: var(--muted);
      font: 1rem var(--mono);
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    .dir {
      min-width: 0;
      overflow: hidden;
      color: var(--text);
      font: 1.15rem var(--mono);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .rescan {
      flex-shrink: 0;
      margin-left: auto;
      padding: 0.3rem 0.9rem;
      border: 0.1rem solid var(--line);
      border-radius: 0.4rem;
      background: transparent;
      color: var(--muted);
      font: 1.1rem var(--mono);
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s;

      &:hover:not(:disabled) {
        border-color: var(--accent-line);
        color: var(--accent);
      }

      &:disabled {
        opacity: 0.4;
        cursor: default;
      }
    }
  }

  .plugin-list {
    margin: 0;
    padding: 0;
    border: 0.1rem solid var(--line);
    border-radius: 0.6rem;
    background: var(--panel);
    list-style: none;
    overflow: hidden;
  }

  .empty {
    margin: 0;
    padding: 2rem 1.8rem;
    border: 0.1rem dashed var(--line);
    border-radius: 0.6rem;
    color: var(--muted);
    font-size: 1.2rem;
    line-height: 1.8;

    code {
      padding: 0.1rem 0.4rem;
      border-radius: 0.3rem;
      background: var(--panel-2);
      color: var(--text);
      font-family: var(--mono);
      font-size: 1.1rem;
    }
  }

  .issue-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin: 0;
    padding: 0.4rem 0 0.4rem 1.2rem;
    border-left: 0.2rem solid var(--fail);
    color: var(--fail);
    font-size: 1.2rem;
    list-style: none;

    code {
      color: var(--text);
      font-family: var(--mono);
      font-size: 1.1rem;
    }
  }
}
</style>
