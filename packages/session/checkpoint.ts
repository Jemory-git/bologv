/**
 * 检查点策略：什么时候必须保证事件已落盘。
 *
 * 存储不知道什么是安全点，策略不知道怎么写文件——两者各自独立可替换。
 * 对当前活跃会话调用 flush()，并广播 checkpoint/flushed。
 */

import type { PluginObject } from '@pkg/cordis'
import {
  CHECKPOINT_SERVICE_NAME,
  SESSION_MANAGER_SERVICE_NAME,
  type CheckpointService,
  type SessionManager,
} from './types.ts'

export const checkpointPlugin: PluginObject = {
  name: 'checkpoint',
  inject: [SESSION_MANAGER_SERVICE_NAME],
  apply(ctx) {    
    const manager = ctx.require<SessionManager>(SESSION_MANAGER_SERVICE_NAME)
    ctx.provide<CheckpointService>(CHECKPOINT_SERVICE_NAME, {
      async at(reason) {
        await manager.active.flush()
        ctx.emit('checkpoint/flushed', reason)
      },
    })
  },
}
