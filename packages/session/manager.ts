/**
 * 会话管理器：唯一挂进 Cordis 的会话服务。
 *
 * 每个会话是一个独立闭包（由 createSessionService 产生），
 * 各自有事件数组、flush 链、pending 队列。SessionManager 只做：
 *   1. 按 id 创建 / 缓存会话实例（onEvent 回调让每个 SessionService 产出的事件都 emit 到 Cordis root）
 *   2. 记录活跃 id（activeId）
 *   3. 维护 per-session 单飞锁（isRunning / setRunning）
 *   4. 扫描 sessions 目录列出磁盘上的会话
 */

import { mkdir, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { PluginObject } from '@pkg/cordis'
import { jsonlStore } from './stores/jsonl.ts'
import { readSessionMeta, writeSessionMeta } from './meta.ts'
import { createSessionService, awaitSessionReady } from './session.ts'
import type { SessionEvent, SessionManager, SessionService } from './types.ts'
import { SESSION_MANAGER_SERVICE_NAME } from './types.ts'

interface InternalEntry {
  store: ReturnType<typeof jsonlStore>
  service: SessionService
  running: boolean
}

/** 会话 id 生成：conv-{timestamp36}-{rand6}，时间戳保证按创建时间倒序。 */
function genSessionId(): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  return `conv-${ts}-${rand}`
}

/** 目录名合法：conv- 开头 + 小写字母数字连字符。 */
const VALID_DIR = /^conv-[a-z0-9]+-[a-z0-9]{6}$/

export interface SessionManagerConfig {
  /** 会话根目录（每个会话一个子目录）。 */
  sessionsRoot: string
  /** 初始活跃会话 id；不存在时会被自动创建。 */
  initialActiveId?: string
}

export const sessionManagerPlugin: PluginObject = {
  name: 'session-manager',
  async apply(ctx, config) {
    const { sessionsRoot, initialActiveId } = (config ?? {}) as unknown as SessionManagerConfig
    if (typeof sessionsRoot !== 'string' || sessionsRoot === '') {
      throw new Error('session-manager: config.sessionsRoot is required')
    }
    await mkdir(sessionsRoot, { recursive: true })

    const entries = new Map<string, InternalEntry>()
    let activeId: string | null = null

    // 所有 SessionService 共用的 onEvent — emit 到 Cordis root
    const emitSessionEvent = (event: SessionEvent) => {
      ctx.emit('session/event', event)
    }

    async function ensureLoaded(id: string): Promise<InternalEntry> {
      const existing = entries.get(id)
      if (existing !== undefined) return existing
      const store = jsonlStore({ root: sessionsRoot, id })
      const service = createSessionService(store, { sessionId: id, onEvent: emitSessionEvent })
      await awaitSessionReady(service)
      const entry: InternalEntry = { store, service, running: false }
      entries.set(id, entry)
      return entry
    }

    const manager: SessionManager = {
      get activeId(): string {
        if (activeId === null) throw new Error('sessionManager: no active session')
        return activeId
      },

      get active(): SessionService {
        return this.get(this.activeId)
      },

      async list(): Promise<string[]> {
        const seen = new Set(entries.keys())
        try {
          const names = await readdir(sessionsRoot)
          for (const name of names) {
            if (VALID_DIR.test(name)) seen.add(name)
          }
        } catch { /* 目录读取失败只返回缓存 */ }
        return [...seen].sort((a, b) => b.localeCompare(a))
      },

      get(id): SessionService {
        const entry = entries.get(id)
        if (entry !== undefined) return entry.service
        // 同步创建未缓存会话：典型流程会先 ensureLoaded 或 create，
        // 这里只作为 get 时的兜底（store.load() 会在后台异步完成）。
        const store = jsonlStore({ root: sessionsRoot, id })
        const service = createSessionService(store, { sessionId: id, onEvent: emitSessionEvent })
        const entry2: InternalEntry = { store, service, running: false }
        entries.set(id, entry2)
        return service
      },

      create() {
        const id = genSessionId()
        const store = jsonlStore({ root: sessionsRoot, id })
        const service = createSessionService(store, { sessionId: id, onEvent: emitSessionEvent })
        const entry: InternalEntry = { store, service, running: false }
        entries.set(id, entry)
        void awaitSessionReady(service)
        return { id, service }
      },

      async getTitle(id): Promise<string | null> {
        const meta = await readSessionMeta(sessionsRoot, id)
        const title = meta?.title
        return typeof title === 'string' && title.trim() !== '' ? title : null
      },

      async rename(id, title): Promise<void> {
        const meta = (await readSessionMeta(sessionsRoot, id)) ?? {}
        await writeSessionMeta(sessionsRoot, id, { ...meta, title })
      },

      async remove(id): Promise<void> {
        const entry = entries.get(id)
        if (entry !== undefined) {
          await entry.service.flush()
          await entry.store.close()
          entries.delete(id)
        }
        // Windows 上刚写完的文件可能短暂被占用（AV / 延迟释放），重试几次再放弃。
        await rm(join(sessionsRoot, id), { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
        // 活跃会话被删后置空；下一次 POST /api/chat 会先 switchActive 到新会话。
        if (activeId === id) activeId = null
      },

      switchActive(id): void {
        activeId = id
      },

      isRunning(id): boolean {
        return entries.get(id)?.running ?? false
      },

      setRunning(id, value): void {
        const entry = entries.get(id)
        if (entry !== undefined) entry.running = value
      },
    }

    // 启动：只在显式指定 initialActiveId 时预加载；否则保持空态。
    // 会话由前端草稿态在首条消息发送时创建，避免启动即产生空会话。
    if (initialActiveId !== undefined) {
      await ensureLoaded(initialActiveId)
      activeId = initialActiveId
    }

    ctx.provide<SessionManager>(SESSION_MANAGER_SERVICE_NAME, manager)

    // 卸载时：flush + close 所有会话
    ctx.effect(async () => {
      for (const [, entry] of entries) {
        try { await entry.service.flush() } catch { /* 静默 */ }
        try { await entry.store.close() } catch { /* 静默 */ }
      }
    })
  },
}
