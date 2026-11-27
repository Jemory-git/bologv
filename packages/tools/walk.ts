/**
 * 工作目录遍历：find_files 与 grep_files 共用的递归扫描。
 *
 * 统一跳过重目录与点目录（node_modules / .git / .开头的条目），
 * 让两个工具看到的文件集合完全一致，避免「find 找得到、grep 搜不到」这类不一致。
 */

import type { ToolFsApi } from './types.ts'

const SKIP_ENTRIES = new Set(['node_modules', '.git', '.svn', '.hg'])

/**
 * 深度优先遍历 startDir 下的所有文件。
 * visit 收到相对工作目录的路径；返回 false 表示达到结果上限，整轮遍历立即停止。
 * 返回值表示遍历是否被提前终止。
 */
export async function walkFiles(
  fs: ToolFsApi,
  startDir: string,
  visit: (relPath: string) => boolean | Promise<boolean>,
): Promise<boolean> {
  let entries: { name: string; isDir: boolean }[]
  try {
    entries = await fs.listDir(startDir)
  } catch {
    // 目录不可读（权限、已被删除）直接跳过，不打断整轮遍历。
    return true
  }

  for (const entry of entries) {
    if (SKIP_ENTRIES.has(entry.name) || entry.name.startsWith('.')) continue
    const relPath = startDir === '' ? entry.name : `${startDir}/${entry.name}`

    if (entry.isDir) {
      const shouldContinue = await walkFiles(fs, relPath, visit)
      if (!shouldContinue) return false
      continue
    }

    const shouldContinue = await visit(relPath)
    if (!shouldContinue) return false
  }
  return true
}
