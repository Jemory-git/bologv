/**
 * 内置插件清单：编译期静态存在，registry 随时可以 use。
 *
 * 固定插件（fixed: true）由 registry 启动时统一 use，之后不可停用；
 * 其余条目由 registry 按持久化状态 / defaultEnabled 启停。
 *
 * 清单顺序即固定插件的装配顺序：electronBridge 必须先于依赖桥接的 registry 内部逻辑。
 */

import type { BuiltinPluginMeta } from './types.ts'
import { vueRenderer } from '@ui/renderer/vue-renderer.ts'
import { electronBridge } from '@ui/plugins/core/electron-bridge.ts'
import { windowControls } from '@ui/plugins/titlebar/window-controls/window-controls.ts'
import { pluginsPage } from '@ui/plugins/plugins-page/plugins-page.ts'
import { schedulesPage } from '@ui/plugins/schedules-page/schedules-page.ts'
import { sessionPathItem } from '@ui/plugins/statusbar/session-path/session-path.ts'
import { versionItem } from '@ui/plugins/statusbar/version/version.ts'
import { reloadBtn } from '@ui/plugins/statusbar/reload/reload.ts'
import { workingDirItem } from '@ui/plugins/statusbar/working-dir/working-dir.ts'
import { adPosition } from '@ui/plugins/ad-position/ad-position.ts'

export const BUILTIN_PLUGINS: BuiltinPluginMeta[] = [
  // —— 固定插件（基础架构，关不掉）——
  {
    origin: 'builtin',
    id: vueRenderer.name,
    plugin: vueRenderer,
    label: '渲染器',
    fixed: true,
    description: 'Vue 渲染进程挂载',
  },
  {
    origin: 'builtin',
    id: electronBridge.name,
    plugin: electronBridge,
    label: '连接',
    fixed: true,
    description: '主进程 IPC 通信',
  },
  {
    origin: 'builtin',
    id: windowControls.name,
    plugin: windowControls,
    label: '窗口控制',
    fixed: true,
    description: '最小化、最大化与关闭当前窗口',
  },
  {
    origin: 'builtin',
    id: pluginsPage.name,
    plugin: pluginsPage,
    label: '插件仓库',
    fixed: true,
    description: '插件管理界面',
  },

  // —— 可切换插件（侧边栏）——
  {
    origin: 'builtin',
    id: adPosition.name,
    plugin: adPosition,
    label: '广告位',
    fixed: false,
    description: '侧边栏底部的单槽广告组件',
  },

  // —— 可切换插件（状态栏条目）——
  {
    origin: 'builtin',
    id: workingDirItem.name,
    plugin: workingDirItem,
    label: '工作目录',
    fixed: false,
    description: '状态栏条目',
  },
  {
    origin: 'builtin',
    id: sessionPathItem.name,
    plugin: sessionPathItem,
    label: '会话路径',
    fixed: false,
    description: '状态栏条目',
  },
  {
    origin: 'builtin',
    id: versionItem.name,
    plugin: versionItem,
    label: '版本号',
    fixed: false,
    description: '状态栏条目',
  },
  {
    origin: 'builtin',
    id: reloadBtn.name,
    plugin: reloadBtn,
    label: '重新加载',
    fixed: false,
    description: '重新加载',
  },

  // —— 可切换插件（功能页）——
  {
    origin: 'builtin',
    id: schedulesPage.name,
    plugin: schedulesPage,
    label: '定时任务',
    fixed: false,
    defaultEnabled: false,
    description: '定时执行的日程管理',
  },
]
