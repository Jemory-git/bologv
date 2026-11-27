/**
 * 外置插件加载器：把 userData 里的一个插件目录变成可 use 的 Cordis Plugin。
 *
 * 通道：同源 HTTP 资源 + 动态 import。
 *   - 渲染进程没有 fs，源码由 Koa 从 userData/plugins 提供；
 *   - 同源 URL 命中 CSP `script-src 'self'`，不需要放宽安全策略；
 *   - 时间戳 query 破除 ESM 模块缓存，这就是「重载」的实现方式。
 *
 * 外置代码与 Vue / bundler 别名完全隔离：它只拿到 host API。
 * 面板内容有两种形态：
 *   mount(el)  —— 插件操作真实 DOM，生命周期由 ExternalViewHost 托管；
 *   component  —— 插件提供 Vue 组件，宿主用自己这份运行时渲染（见 vue-api.ts）。
 */

import type { Context, Plugin } from '@pkg/cordis'
import type {
  ExternalHost,
  ExternalPluginMeta,
  ExternalPluginModule,
  ExternalViewHostProps,
  ExternalViewOptions,
} from './types.ts'
import PanelEntry from '@ui/components/sidebar/PanelEntry.vue'
import ExternalViewHost from '@ui/components/slots/ExternalViewHost.vue'
import { sidebarPanels, statusbarItems } from '@ui/slots'
import { externalVueApi } from './vue-api.ts'

/** 面板 id 前缀：外置插件只提供插件内唯一的 id，避免和内置面板撞名。 */
const PANEL_PREFIX = 'external'

/** 同源资源地址；id 与文件名仍由服务端二次校验。 */
export function externalAssetUrl(id: string, file: string): string {
  return `/api/external-plugins/assets/${encodeURIComponent(id)}/${encodeURIComponent(file)}`
}

/** 动态 import 插件入口，校验 ABI 后包装成 Cordis Plugin。 */
export async function loadExternalPlugin(meta: ExternalPluginMeta): Promise<Plugin> {
  const specifier = `${externalAssetUrl(meta.id, meta.entry)}?t=${Date.now()}`
  const module = (await import(/* @vite-ignore */ specifier)) as { default?: unknown }

  const exported = module.default
  if (
    typeof exported !== 'object'
    || exported === null
    || typeof (exported as ExternalPluginModule).apply !== 'function'
  ) {
    throw new Error(`${meta.entry} 必须默认导出 { apply(host) }`)
  }
  const pluginModule = exported as ExternalPluginModule

  return {
    name: `external:${meta.id}`,
    apply: (ctx) => pluginModule.apply(createHostApi(ctx, meta)),
  }
}

/** 宿主能力：注册即效果，随插件 scope 一起回收。 */
function createHostApi(ctx: Context, meta: ExternalPluginMeta): ExternalHost {
  return {
    id: meta.id,
    version: meta.version ?? '0.0.0',
    vue: externalVueApi,
    ui: {
      registerPanel(options) {
        const panelId = typeof options.id === 'string' ? options.id.trim() : ''
        const label = typeof options.label === 'string' ? options.label.trim() : ''
        if (panelId === '' || label === '') {
          throw new Error('registerPanel 需要非空的 id 与 label')
        }
        const viewProps = resolveViewProps(options)
        ctx.effect(
          sidebarPanels.register(
            `${PANEL_PREFIX}:${meta.id}:${panelId}`,
            { component: PanelEntry, props: () => ({ label }) },
            { component: ExternalViewHost, props: () => viewProps },
          ),
        )
      },
      registerStatusBar(options) {
        const viewProps = resolveViewProps(options)
        ctx.effect(statusbarItems.register(ExternalViewHost, () => viewProps))
      },
      injectStyle(css) {
        if (typeof css !== 'string' || css.trim() === '') return
        const style = document.createElement('style')
        style.dataset.externalPlugin = meta.id
        style.textContent = css
        document.head.append(style)
        ctx.effect(() => style.remove())
      },
    },
    log: (...args) => console.log(`[external:${meta.id}]`, ...args),
  }
}

/** 校验视图内容形态并归一为 ExternalViewHost 的 props；mount 与 component 恰好给一个。 */
function resolveViewProps(options: ExternalViewOptions): ExternalViewHostProps {
  if (options.mount !== undefined && options.component !== undefined) {
    throw new Error('mount 与 component 只能二选一')
  }
  if (typeof options.mount === 'function') return { mount: options.mount }
  if (options.component !== undefined) return { component: options.component }
  throw new Error('需要提供 mount 或 component')
}
