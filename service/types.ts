import type { Booted } from '../boot.ts'

export interface ServerHandle {
  port: number
  close(): Promise<void>
}

export interface StartServiceOptions {
  port: number
  /** 生产模式下 Koa serve 的静态目录。开发模式传 undefined。 */
  uiRoot?: string
  /** 插件树就绪 Promise，由组合根（main.ts）注入；chat/sessions 等路由共用。 */
  bootedPromise: Promise<Booted>
}
