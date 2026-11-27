/**
 * 插件树装配：createRoot + 按插件清单逐个 use。
 *
 * 对外暴露 Booted 结构，供 Koa server 和生命周期层消费。
 */

import { isAbsolute, resolve } from 'node:path'
import { app } from 'electron'
import { createRoot, type Context } from '@pkg/cordis'
import { SESSION_MANAGER_SERVICE_NAME, type SessionEvent, type SessionManager } from '@pkg/session'
import { AGENT_LOOP_SERVICE_NAME, type AgentLoopService } from '@pkg/loop'
import { pluginManifest } from '@pkg/agent-assistant'
import { loadModels, loadToolSettings, resolveWorkingDir } from './service/storage/index.ts'
import { APP_PATHS } from './service/paths.ts'
import { resolveImageEmbeds } from './service/references/image-embed.ts'
import { inspectReferencePath, readReferenceBytes, readReferenceText } from './service/references/files.ts'
import type { ReferenceReaderApi, SystemInfo } from '@pkg/tools'

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

  const workingDir = await resolveWorkingDir()
  const sessionsRoot = APP_PATHS.sessionsDir

  // 并发读取持久化配置（boot 时读一次；models 例外——provider 按请求时点读取）
  const toolSettings = await loadToolSettings()

  // 参考文件读取能力：复用 references 规则读任意绝对路径，注入给 read_file/understand_image 工具。
  const referenceReader: ReferenceReaderApi = {
    inspect: (path) => inspectReferencePath(path),
    readText: async (path) => readReferenceText(await inspectReferencePath(path)),
    readImage2B64: async (path) => {
      const reference = await inspectReferencePath(path)
      const data = await readReferenceBytes(reference)
      return data === null ? null : { mime: reference.mime, data: data.toString('base64') }
    },
  }

  // 覆盖写保护：从活跃会话的事件日志判断「本会话是否已成功读过该文件」。
  // 工具是单例、不持有会话状态，因此这份查询由组合根注入。
  const hasReadFile = async (absolutePath: string): Promise<boolean> => {
    const manager = root.get<SessionManager>(SESSION_MANAGER_SERVICE_NAME)
    if (manager === undefined) return false

    let events: readonly SessionEvent[]
    try {
      events = manager.active.events()
    } catch {
      // 没有活跃会话（理论上不会发生在工具执行期），按未读过处理。
      return false
    }

    const target = normalizePath(workingDir, absolutePath)
    const callIds = new Set<string>()
    for (const event of events) {
      if (event.type !== 'tool/call' || event.name !== 'read_file') continue
      const path = typeof event.args.path === 'string' ? event.args.path : ''
      if (path !== '' && normalizePath(workingDir, path) === target) callIds.add(event.callId)
    }
    if (callIds.size === 0) return false
    return events.some((event) => event.type === 'tool/result' && event.ok && callIds.has(event.callId))
  }

  // 应用自身信息：只读快照，供 get_system_info 工具回答「装在哪、配置在哪」。
  const systemInfo: SystemInfo = {
    appVersion: app.getVersion(),
    installDir: APP_PATHS.installDir,
    settingsDir: APP_PATHS.settingsDir,
    sessionsDir: sessionsRoot,
    workingDir,
    platform: process.platform,
    arch: process.arch,
    electronVersion: process.versions.electron ?? '',
    nodeVersion: process.versions.node,
  }

  // 并发启动：每个插件自行 wait(inject)，顺序与加载结果无关。
  await Promise.all(
    pluginManifest({
      sessionsRoot,
      workingDir,
      getVendors: loadModels,
      resolveImageEmbeds,
      toolSettings,
      referenceReader,
      hasReadFile,
      systemInfo,
    }).map((entry) => root.use(entry.plugin, entry.config)),
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

/** 路径归一：相对路径按工作目录展开；Windows 文件系统忽略大小写，比较时一并小写。 */
function normalizePath(workingDir: string, input: string): string {
  const absolute = isAbsolute(input) ? resolve(input) : resolve(workingDir, input)
  return process.platform === 'win32' ? absolute.toLowerCase() : absolute
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
