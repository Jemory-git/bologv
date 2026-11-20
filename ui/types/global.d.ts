/**
 * 全局 window 扩展声明。
 * .d.ts 后缀让 TS 自动拾取，不需要显式 import。
 */

import type { BologuiApi } from './ipc.ts'

declare global {
  interface Window {
    bologui?: BologuiApi
  }
}

export {}
