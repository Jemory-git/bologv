/**
 * 插件树装配：createRoot + 按插件清单逐个 use。
 *
 * 对外暴露 Booted 结构，供 Koa server 和生命周期层消费。
 */

import { join } from 'node:path'
import { app } from 'electron'
import { createRoot, type Context } from '@pkg/cordis'
import { SESSION_SERVICE_NAME, type SessionService, type SessionStore } from '@pkg/session'
import { AGENT_LOOP_SERVICE_NAME, type AgentLoopService } from '@pkg/runtime'
import { pluginManifest } from '@pkg/agent-assistant'
import { jsonlStore } from '@pkg/session'
import { loadModels } from './service/storage/index.ts'

export interface Booted {
  root: Context
  store: SessionStore
  session: SessionService
  loop: AgentLoopService
  plugins: string[]
  sessionPath: string
  /** 文件类工具的沙箱根目录；启动时确定，IPC 与工具共用这一份。 */
  workingDir: string
}

let booting: Promise<Booted> | undefined

/** 启动插件树；会话和设置落在用户数据目录，安装目录保持只读。 */
async function doBoot(): Promise<Booted> {
  const root = createRoot()
  const plugins: string[] = []
  root.on('plugin/ready', (name) => {
    plugins.push(String(name))
  })

  const workingDir = process.cwd()
  const sessionRoot = join(app.getPath('userData'), 'sessions')
  const store = jsonlStore({ root: sessionRoot, id: 'default' })
  for (const entry of pluginManifest(store, loadModels, workingDir)) {
    await root.use(entry.plugin, entry.config)
  }

  const session = root.require<SessionService>(SESSION_SERVICE_NAME)
  const loop = root.require<AgentLoopService>(AGENT_LOOP_SERVICE_NAME)
  return {
    root,
    store,
    session,
    loop,
    plugins,
    workingDir,
    sessionPath: join(sessionRoot, 'default', 'v1.jsonl'),
  }
}

/** 同一个插件树只启动一次；窗口重建时复用。 */
export function ensureBooted(): Promise<Booted> {
  booting ??= doBoot()
  return booting
}

/** teardown 时消费：flush → close store → close root。 */
export async function teardown(): Promise<void> {
  const booted = await booting?.catch(() => undefined)
  if (booted === undefined) return
  await booted.session.flush()
  await booted.store.close()
  booted.root.close()
}
