/**
 * storage 内部通用工具：JSON 文件读写。
 * 所有存储模块共享。
 *
 * 崩溃安全：写入走「临时文件 + rename」原子替换，读者永远看不到半截内容；
 * 读取遇到损坏（解析失败或形状不符）时隔离原件并回退默认值，不阻塞启动。
 */

import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'

export const SETTINGS_DIR = join(app.getPath('userData'), 'settings')

/** 临时文件后缀序号：pid + 自增序号，并发写同一文件时互不覆盖临时文件。 */
let tmpSeq = 0

async function ensureDir(): Promise<void> {
  await mkdir(SETTINGS_DIR, { recursive: true })
}

/**
 * 读取 JSON 配置；文件缺失或损坏时回退默认值。
 * parse 可选做形状校验（抛错即视为不可信），与解析失败同等处理。
 */
export async function readJsonFile<T>(path: string, fallback: T, parse?: (raw: unknown) => T): Promise<T> {
  let text: string
  try {
    text = await readFile(path, 'utf-8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      await writeJsonFile(path, fallback)
      return fallback
    }
    throw error
  }
  try {
    const raw: unknown = JSON.parse(text)
    return parse ? parse(raw) : (raw as T)
  } catch {
    // 写一半崩溃或手工改坏：隔离原件留待人工恢复，用默认值重建。
    await rename(path, `${path}.corrupt-${Date.now()}`).catch(() => undefined)
    await writeJsonFile(path, fallback)
    return fallback
  }
}

/** 原子写：先写同目录临时文件，再 rename 替换。 */
export async function writeJsonFile<T>(path: string, data: T): Promise<void> {
  await ensureDir()
  const tmp = `${path}.${process.pid}.${++tmpSeq}.tmp`
  try {
    await writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8')
    await rename(tmp, path)
  } catch (error) {
    await rm(tmp, { force: true }).catch(() => undefined)
    throw error
  }
}
