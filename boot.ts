/**
 * 插件树装配：createRoot + 按插件清单逐个 use。
 *
 * 对外暴露 Booted 结构，供 Koa server 和生命周期层消费。
 */

import { join } from 'node:path'
import { app } from 'electron'
import { createRoot, type Context } from '@pkg/cordis'
import { SESSION_MANAGER_SERVICE_NAME, type SessionManager } from '@pkg/session'
import { AGENT_LOOP_SERVICE_NAME, type AgentLoopService } from '@pkg/runtime'
import { pluginManifest } from '@pkg/agent-assistant'
import { loadModels } from './service/storage/index.ts'
import { resolveReferenceParts } from './service/references/resolve.ts'

export interface Booted {
  root: Context
  manager: SessionManager
  loop: AgentLoopService
  plugins: string[]
  /** 会话根目录；每个会话一个子目录。 */
  sessionsRoot: string
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
  const sessionsRoot = join(app.getPath('userData'), 'sessions')

  // 并发启动：每个插件自行 wait(inject)，顺序与加载结果无关。
  await Promise.all(
    pluginManifest(sessionsRoot, loadModels, workingDir, resolveReferenceParts).map((entry) =>
      root.use(entry.plugin, entry.config),
    ),
  )

  const manager = root.require<SessionManager>(SESSION_MANAGER_SERVICE_NAME)
  const loop = root.require<AgentLoopService>(AGENT_LOOP_SERVICE_NAME)
  return {
    root,
    manager,
    loop,
    plugins,
    workingDir,
    sessionsRoot,
  }
}

/** 同一个插件树只启动一次；窗口重建时复用。 */
export function ensureBooted(): Promise<Booted> {
  booting ??= doBoot()
  return booting
}

/** teardown 时消费：manager 内部已在 effect 里 flush + close 所有会话，只需 close root。 */
export async function teardown(): Promise<void> {
  const booted = await booting?.catch(() => undefined)
  if (booted === undefined) return
  booted.root.close()
}
