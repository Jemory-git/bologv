/**
 * 存储 Provider 之一：追加式 JSONL 文件。
 * 对应真实仓库 packages/session/session-persistence-jsonl。
 *
 * 三个工程要点：
 * 1. 格式版本写进文件名，新代码不会误读旧文件。
 * 2. 追加写只可能损坏最后一行，读取时丢弃尾部不完整记录即可。
 * 3. 同一会话只允许一个写者：第二条路径打开时直接失败，不排队也不合并。
 *    锁内记录 PID，持有者已被强杀（锁未释放但没有活跃进程）时可以安全接管。
 */

import { appendFile, link, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { StorageError } from '../errors.ts'
import type { SessionEvent, SessionStore } from '../types.ts'

const LOG_VERSION = 1

export interface JsonlStoreOptions {
  /** 会话根目录；每个会话一个子目录。 */
  root: string
  /** 会话标识，决定读写哪个日志文件。 */
  id: string
}

export function jsonlStore(options: JsonlStoreOptions): SessionStore {
  const dir = join(options.root, options.id)
  const logPath = join(dir, `v${LOG_VERSION}.jsonl`)
  const lockPath = join(dir, 'writer.lock')
  let locked = false

  return {
    async load() {
      await mkdir(dir, { recursive: true })
      await acquireLock()
      let text: string
      try {
        text = await readFile(logPath, 'utf8')
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
        throw error
      }
      const events: SessionEvent[] = []
      for (const line of text.split('\n')) {
        if (line === '') continue
        try {
          const event = JSON.parse(line) as SessionEvent
          // 旧日志可能缺 ts（后加字段）；回退 0 表示「时间未知」，读取即完成迁移。
          events.push(typeof event.ts === 'number' ? event : { ...event, ts: 0 })
        } catch {
          // 崩溃时最后一行可能只写了一半；日志是事实源，尾部残缺即丢弃。
          console.warn(`[session] ${logPath}: 丢弃损坏的日志行: ${line.slice(0, 80)}`)
        }
      }
      return events
    },
    async append(batch) {
      if (batch.length === 0) return
      const lines = batch.map((event) => JSON.stringify(event)).join('\n')
      try {
        await appendFile(logPath, `${lines}\n`, 'utf8')
      } catch (error) {
        // 持久化失败转成域错误：边界映射进 envelope，UI 才能读到消息并常驻告警。
        const code = (error as NodeJS.ErrnoException).code ?? 'UNKNOWN'
        const detail = error instanceof Error ? error.message : String(error)
        throw new StorageError(`会话保存失败（${code}）：${detail}`, code)
      }
    },
    async close() {
      if (!locked) return
      locked = false
      await rm(lockPath, { force: true })
    },
  }

  async function acquireLock(): Promise<void> {
    if (locked) return
    try {
      await writeLockFile()
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      if (!(await isLockStale())) {
        throw new Error(
          `session "${options.id}" is already open by another process (lock: ${lockPath}). ` +
          'If that process is gone, delete the lock file and retry.',
        )
      }
      // 持有者被强杀时不会执行 close()，留下的锁可以接管。
      await rm(lockPath, { force: true })
      await writeLockFile()
    }
    locked = true
  }

  async function writeLockFile(): Promise<void> {
    // PID 先落临时文件，再硬链接原子占位（目标已存在则 EEXIST）：
    // 锁文件要么不存在、要么内容完整，消除「先建空文件再异步写 PID」的空窗——
    // 否则并发读者会把空锁判成 stale 而接管，造成双写者。
    const tmpPath = `${lockPath}.${process.pid}.tmp`
    await writeFile(tmpPath, String(process.pid), 'utf8')
    try {
      await link(tmpPath, lockPath)
    } finally {
      await rm(tmpPath, { force: true })
    }
  }

  async function isLockStale(): Promise<boolean> {
    const text = await readFile(lockPath, 'utf8').catch(() => '')
    const pid = Number.parseInt(text, 10)
    // 旧版本留下的空锁同样没有可确认的持有者。
    if (!Number.isInteger(pid) || pid <= 0) return true
    try {
      process.kill(pid, 0)
      return false
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === 'ESRCH'
    }
  }
}
