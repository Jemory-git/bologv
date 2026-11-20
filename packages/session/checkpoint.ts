/**
 * 检查点策略。对应真实仓库 packages/session/session-checkpoint-policy。
 *
 * 它只回答一件事：什么时候必须保证事件已落盘。
 * 存储不知道什么是安全点，策略不知道怎么写文件——两者各自独立可替换。
 */

import type { Plugin } from '@pkg/cordis'
import {
  CHECKPOINT_SERVICE_NAME,
  SESSION_SERVICE_NAME,
  type CheckpointService,
  type SessionService,
} from './types.ts'

export const checkpointPlugin: Plugin = {
  name: 'checkpoint',
  inject: [SESSION_SERVICE_NAME],
  apply(ctx) {
    const session = ctx.require<SessionService>(SESSION_SERVICE_NAME)
    ctx.provide<CheckpointService>(CHECKPOINT_SERVICE_NAME, {
      async at(reason) {
        await session.flush()
        ctx.emit('checkpoint/flushed', reason)
      },
    })
  },
}
