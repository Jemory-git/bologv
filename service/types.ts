export interface ServerHandle {
  port: number
  close(): Promise<void>
}

export interface StartServiceOptions {
  port: number
  /** 生产模式下 Koa serve 的静态目录。开发模式传 undefined。 */
  uiRoot?: string
}
