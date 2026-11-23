<script setup lang="ts">
  /**
   * 外置插件能力说明 —— host ABI 的对外展示面。
   * 改动 external.ts 里注入的宿主能力时应同步这里，避免文档与实现漂移。
   */

  //states
  const capabilities = [
    { name: 'host.id / host.version', description: '插件身份与版本，来自 manifest.json' },
    { name: 'host.vue', description: '宿主注入的 Vue 运行时：h / defineComponent / ref / reactive / computed / watch / 生命周期钩子等' },
    { name: 'host.ui.registerPanel', description: '注册侧边栏面板；component 与 mount 二选一' },
    { name: 'host.ui.registerStatusBar', description: '注册状态栏条目；component 与 mount 二选一，不需要 id/label，颜色与字号继承状态栏' },
    { name: 'host.ui.injectStyle', description: '注入全局样式，停用插件时自动移除' },
    { name: 'host.log', description: '带插件前缀的日志输出' },
  ]

  const snippet = `export default {
  apply(host) {
    const { defineComponent, h, ref } = host.vue

    const Panel = defineComponent({
      setup() {
        const count = ref(0)
        return () => h('button', { onClick: () => { count.value += 1 } }, '点击 ' + count.value)
      },
    })

    host.ui.registerPanel({ id: 'demo', label: '示例面板', component: Panel })
  },
}`
</script>

<template>
  <div class="capabilities">
    <ul class="capability-list">
      <li v-for="item in capabilities" :key="item.name" class="capability-item">
        <code class="capability-name">{{ item.name }}</code>
        <span class="capability-desc">{{ item.description }}</span>
      </li>
    </ul>

    <figure class="example">
      <figcaption>main.js</figcaption>
      <pre><code>{{ snippet }}</code></pre>
    </figure>
  </div>
</template>

<style scoped lang="scss">
.capabilities {
  display: flex;
  flex-direction: column;
  gap: 1.4rem;

  .capability-list {
    margin: 0;
    padding: 0;
    border: 0.1rem solid var(--line);
    border-radius: 0.6rem;
    background: var(--panel);
    list-style: none;
    overflow: hidden;
  }

  .capability-item {
    display: grid;
    grid-template-columns: minmax(16rem, 22rem) 1fr;
    gap: 2rem;
    align-items: baseline;
    padding: 1rem 1.6rem;

    &+& {
      border-top: 0.1rem solid var(--line);
    }
  }

  .capability-name {
    color: var(--accent);
    font: 1.15rem var(--mono);
    word-break: break-all;
  }

  .capability-desc {
    color: var(--muted);
    font-size: 1.2rem;
    line-height: 1.7;
  }

  .example {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    margin: 0;

    figcaption {
      color: var(--muted);
      font: 1rem var(--mono);
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    pre {
      margin: 0;
      padding: 1.4rem 1.6rem;
      border: 0.1rem solid var(--line);
      border-radius: 0.6rem;
      background: var(--bg);
      overflow-x: auto;
      color: var(--text);
      font: 1.15rem/1.75 var(--mono);
      white-space: pre;
    }
  }
}
</style>
