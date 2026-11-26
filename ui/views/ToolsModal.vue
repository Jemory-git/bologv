<script setup lang="ts">
  /**
   * 工具配置：查看 catalog + 控制 enabled/favorite。
   *
   * 数据源是 tools store：打开时 load() 取最新 catalog（生效值）和 settings；
   * toggle 即时写回后端并热更新，框架级工具的控件按 flags 锁定。
   *
   * tool 本身由开发者在代码里注册（packages/tools/impl/ 下加文件），
   * 用户不能在 UI 里增删工具，只能控制启用和标记常用。
   */

  // ———————————— imports ————————————
  import { computed, onMounted, ref } from 'vue'
  import { useToolsStore } from '@ui/stores/tools.ts'
  import type { ToolCatalogItem } from '@pkg/tools'

  // ============================================================================
  // states
  // ============================================================================

  const tools = useToolsStore()

  const selectedName = ref<string | null>(null)
  const selected = computed<ToolCatalogItem | null>(() =>
    tools.catalog.find((t) => t.name === selectedName.value) ?? null,
  )

  const loading = ref(true)
  const error = ref<string | null>(null)

  // ============================================================================
  // methods
  // ============================================================================

  async function toggleEnabled(item: ToolCatalogItem): Promise<void> {
    error.value = await tools.toggleEnabled(item)
  }

  async function toggleFavorite(item: ToolCatalogItem): Promise<void> {
    error.value = await tools.toggleFavorite(item)
  }

  // ============================================================================
  // hooks
  // ============================================================================

  onMounted(async () => {
    const loadErr = await tools.load()
    loading.value = false
    if (loadErr !== null) {
      error.value = loadErr
      return
    }
    selectedName.value = tools.catalog[0]?.name ?? null
  })
</script>

<template>
  <div class="tools-modal">
    <!-- 左侧：工具列表 -->
    <aside class="catalog-pane thin-bar">
      <header class="pane-header">
        <h3>工具</h3>
      </header>

      <div v-if="loading" class="empty-hint">加载中…</div>
      <ul v-else-if="tools.catalog.length > 0" class="tool-list">
        <li
          v-for="t in tools.catalog"
          :key="t.name"
          class="tool-item"
          :class="{
            active: t.name === selectedName,
            disabled: !t.enabled,
          }"
          @click="selectedName = t.name"
        >
          <span class="tool-name">{{ t.name }}</span>
          <span v-if="t.favorite" class="favorite-badge">★</span>
          <span v-if="!t.enabled" class="disabled-hint">已禁用</span>
        </li>
      </ul>
      <p v-else class="empty-hint">暂无可用工具</p>
    </aside>

    <!-- 右侧：详情 -->
    <section class="detail-pane" v-if="selected">
      <header class="pane-header">
        <h3>{{ selected.name }}</h3>
      </header>

      <div class="tool-info">
        <p class="description">{{ selected.description }}</p>

        <div class="toggles">
          <label class="toggle" :class="{ locked: !selected.disableable }">
            <input
              type="checkbox"
              :checked="selected.enabled"
              :disabled="!selected.disableable || tools.saving"
              @change="toggleEnabled(selected)"
            />
            <span>启用</span>
          </label>
          <label class="toggle" :class="{ locked: !selected.favoriteEditable }">
            <input
              type="checkbox"
              :checked="selected.favorite"
              :disabled="!selected.favoriteEditable || tools.saving"
              @change="toggleFavorite(selected)"
            />
            <span>常用（每轮对话必带）</span>
          </label>
        </div>
      </div>

      <hr class="divider" />

      <div class="schema-section">
        <h4>参数 Schema</h4>
        <pre class="schema-json">{{ JSON.stringify(selected.parameters, null, 2) }}</pre>
      </div>

      <footer class="form-actions">
        <p v-if="error" class="form-error">{{ error }}</p>
        <p v-else-if="tools.saving" class="form-hint">保存中…</p>
        <div class="spacer" />
      </footer>
    </section>

    <!-- 空态 -->
    <section v-else class="detail-pane empty-pane">
      <p class="empty-hint">← 请从左侧选择一个工具</p>
    </section>
  </div>
</template>

<style scoped lang="scss">
/* ==========================================================================
   Structure: .tools-modal > .catalog-pane | .detail-pane(.empty-pane)
   ========================================================================== */

.tools-modal {
  display: flex;
  gap: 2rem;
  height: 100%;
  min-height: 0;

  .catalog-pane {
    width: 20rem;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
    padding-right: 2rem;
    border-right: 0.1rem solid var(--line);
    overflow-y: auto;

    .tool-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .tool-item {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.8rem 1rem;
      border-radius: 0.6rem;
      cursor: pointer;
      font-size: 1.3rem;
      color: var(--muted);

      &:hover {
        background: var(--panel-2);
        color: var(--text);
      }

      &.active {
        background: var(--accent-soft);
        color: var(--text);
      }

      &.disabled {
        .tool-name {
          text-decoration: line-through;
          opacity: 0.5;
        }
      }

      .tool-name {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-family: monospace;
        font-size: 1.2rem;
      }

      .favorite-badge {
        color: var(--accent);
        font-size: 1.2rem;
      }

      .disabled-hint {
        font-size: 1rem;
        color: var(--muted);
      }
    }
  }

  .detail-pane {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 1.6rem;

    &.empty-pane {
      align-items: center;
      justify-content: center;
      color: var(--muted);
    }

    .tool-info {
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      gap: 1.2rem;

      .description {
        font-size: 1.3rem;
        line-height: 1.6;
        color: var(--text);
        margin: 0;
      }

      .toggles {
        display: flex;
        gap: 1.6rem;

        .toggle {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          font-size: 1.2rem;
          color: var(--muted);

          input {
            accent-color: var(--accent);
          }

          &.locked {
            opacity: 0.5;
            cursor: not-allowed;
          }
        }
      }
    }

    .divider {
      border: none;
      border-top: 0.1rem solid var(--line);
      margin: 0;
      flex-shrink: 0;
    }

    .schema-section {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
      overflow: hidden;

      h4 {
        margin: 0;
        font-size: 1.2rem;
        font-weight: 600;
        color: var(--text);
        flex-shrink: 0;
      }

      .schema-json {
        flex: 1;
        min-height: 0;
        margin: 0;
        padding: 1.2rem;
        background: var(--panel-2);
        border-radius: 0.5rem;
        overflow: auto;
        font-family: monospace;
        font-size: 1.1rem;
        line-height: 1.5;
        color: var(--muted);
      }
    }

    .form-actions {
      display: flex;
      align-items: center;
      gap: 0.8rem;
      padding-top: 1.2rem;
      border-top: 0.1rem solid var(--line);
      flex-shrink: 0;

      .form-error {
        color: var(--fail);
        font-size: 1.2rem;
        margin: 0;
      }

      .form-hint {
        color: var(--muted);
        font-size: 1.2rem;
        margin: 0;
      }
    }
  }

  // —— 通用 ——

  .pane-header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    h3 {
      margin: 0;
      font-size: 1.3rem;
      font-weight: 600;
      color: var(--text);
    }
  }

  .empty-hint {
    font-size: 1.2rem;
    color: var(--muted);
    margin: 0;
  }

  .spacer {
    flex: 1;
  }
}
</style>
