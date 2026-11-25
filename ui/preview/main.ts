/**
 * 预览窗口入口：只挂载预览应用，不初始化插件、状态栏与会话。
 * 预览是只读能力，和主应用的启动复杂度完全解耦。
 */

import '../styles/index.scss'
import { createApp } from 'vue'
import PreviewApp from './PreviewApp.vue'

createApp(PreviewApp).mount('#app')
