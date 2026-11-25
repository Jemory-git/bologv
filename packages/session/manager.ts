/**
 * 会话管理器：唯一挂进 Cordis 的会话服务。
 *
 * 两类访问严格分开：
 *   - 摘要 / 历史读取：只读文件，不创建实例、不持写者锁
 *   - 运行时：按需加载实例（SessionService + store），并维护 per-session 单飞锁
 *
 * 实例生命周期：切换活跃会话时加载目标、释放上一个空闲实例；
 * 运行中的实例保留到本轮结束（finishRun），避免后台任务失去写入通道。
 */

import { mkdir, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { PluginObject } from '@pkg/cordis'
import { jsonlStore } from './stores/jsonl.ts'
import { readSessionMeta, writeSessionMeta } from './meta.ts'
import { factsFromEvents, readLogEvents, readSessionFacts } from './facts.ts'
import { createSessionService, awaitSessionReady } from './session.ts'
import type { SessionEvent, SessionFacts, SessionManager, SessionService } from './types.ts'
import { SESSION_MANAGER_SERVICE_NAME } from './types.ts'

interface InternalEntry {
  store: ReturnType<typeof jsonlStore>
  service: SessionService
  /** 存储加载（含取得写者锁）的就绪 Promise；未就绪前不得追加事件。 */
  ready: Promise<void>
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
      if (existing !== undefined) {
        await existing.ready
        return existing
      }
      const store = jsonlStore({ root: sessionsRoot, id })
      const service = createSessionService(store, { sessionId: id, onEvent: emitSessionEvent })
      const ready = awaitSessionReady(service)
      const entry: InternalEntry = { store, service, ready, running: false }
      entries.set(id, entry)
      try {
        await ready
      } catch (error) {
        // 加载失败（例如锁冲突）不保留半就绪实例，避免后续调用拿到坏状态。
        entries.delete(id)
        throw error
      }
      return entry
    }

    /**
     * 释放空闲实例：flush + close + 移出缓存。
     * 运行中的会话与当前活跃会话不释放。
     */
    async function release(id: string): Promise<void> {
      const entry = entries.get(id)
      if (entry === undefined || entry.running || activeId === id) return
      entries.delete(id)
      try {
        await entry.service.flush()
      } finally {
        await entry.store.close()
      }
    }

    const manager: SessionManager = {
      get activeId(): string {
        if (activeId === null) throw new Error('sessionManager: no active session')
        return activeId
      },

      get active(): SessionService {
        const id = this.activeId
        const entry = entries.get(id)
        if (entry === undefined) throw new Error(`sessionManager: session "${id}" is not loaded`)
        return entry.service
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

      async summarize(id): Promise<SessionFacts> {
        const title = await this.getTitle(id)
        const entry = entries.get(id)
        // 驻留实例的内存事件比文件更新（可能尚未 flush），优先使用。
        if (entry !== undefined) return factsFromEvents(id, entry.service.events(), title)
        return readSessionFacts(sessionsRoot, id)
      },

      async readEvents(id): Promise<readonly SessionEvent[]> {
        const entry = entries.get(id)
        if (entry !== undefined) return entry.service.events()
        return readLogEvents(sessionsRoot, id)
      },

      create() {
        const id = genSessionId()
        const store = jsonlStore({ root: sessionsRoot, id })
        const service = createSessionService(store, { sessionId: id, onEvent: emitSessionEvent })
        const ready = awaitSessionReady(service)
        const entry: InternalEntry = { store, service, ready, running: false }
        entries.set(id, entry)
        // 失败由后续 ensureLoaded 统一抛出；这里只避免未处理的 rejection。
        void ready.catch(() => {})
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

      async switchActive(id): Promise<void> {
        if (activeId === id) return
        await ensureLoaded(id)
        const previous = activeId
        activeId = id
        if (previous !== null) await release(previous)
      },

      async beginRun(id): Promise<boolean> {
        const entry = await ensureLoaded(id)
        if (entry.running) return false
        entry.running = true
        return true
      },

      async finishRun(id): Promise<void> {
        const entry = entries.get(id)
        if (entry === undefined) return
        entry.running = false
        // 切走的会话在本轮结束后立刻回收；活跃会话保留。
        if (activeId !== id) await release(id)
      },

      isRunning(id): boolean {
        return entries.get(id)?.running ?? false
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
