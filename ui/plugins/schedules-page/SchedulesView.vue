<script setup lang="ts">
/**
 * 自动化任务页：占位面板。
 * 调度需要主进程能力，这里先占住 `schedules` 这个 key，
 * 让导航链路可以被完整验证。
 */
</script>

<template>
  <section class="panel-page">
    <header class="page-header">
      <h1>自动化任务</h1>
      <span class="tag">未实现</span>
    </header>
    <p class="lede">定时触发需要主进程提供调度能力，这一阶段只保留入口。</p>
    <ol class="steps">
      <li>插件把 <code>schedules</code> 注册成面板。</li>
      <li>侧边栏从注册表生成对应的一行。</li>
      <li>主区域按同一个 key 渲染这个组件。</li>
    </ol>
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

.tag {
  padding: 0.1rem 0.8rem;
  border: 0.1rem solid var(--line);
  border-radius: 99.9rem;
  color: var(--muted);
  font-size: 1.1rem;
}

.lede {
  margin: 0;
  color: var(--muted);
  font-size: 1.3rem;
}

.steps {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  margin: 0;
  padding-left: 2rem;
  color: var(--text);
  font-size: 1.3rem;
}

code {
  padding: 0.1rem 0.5rem;
  border-radius: 0.4rem;
  background: var(--panel-2);
  font: 1.2rem var(--mono);
}
</style>
