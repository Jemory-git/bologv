declare module '*.scss';
declare module '*.sass';
declare module '*.css';

// unplugin-icons 虚拟模块 —— Vite 插件按需提取 SVG，TS 需要声明。
declare module '~icons/*' {
  import type { Component } from 'vue'
  const component: Component
  export default component
}