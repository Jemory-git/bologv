/**
 * glob 匹配：把 "*.ts"、"src/**\/*.vue" 这类模式转成路径判定函数。
 *
 * 规则（与工具描述保持一致，模型据此预期行为）：
 *   - 模式不含 "/"：按文件名匹配，任意层级都算命中（"*.ts" 等价于任意深度的 ts 文件）；
 *   - 模式含 "/"：对相对路径整体匹配；
 *   - "**" 跨目录、"*" 不跨目录、"?" 匹配单个字符；
 *   - 大小写不敏感（Windows/macOS 文件系统本身如此，统一按不敏感处理避免平台差异）。
 *
 * find_files 的 pattern 与 grep_files 的 include 共用本模块。
 */

const CACHE_LIMIT = 100
const cache = new Map<string, RegExp>()

/** 返回一个判定函数：输入相对路径（"/" 分隔），返回是否命中模式。 */
export function globMatcher(pattern: string): (relPath: string) => boolean {
  const normalized = pattern.trim().replace(/\\/g, '/')
  const byBasename = !normalized.includes('/')

  let regex = cache.get(normalized)
  if (regex === undefined) {
    regex = new RegExp(`^${toRegExpSource(normalized)}$`, 'i')
    if (cache.size >= CACHE_LIMIT) cache.clear()
    cache.set(normalized, regex)
  }

  return (relPath) =>
    byBasename
      ? regex.test(relPath.slice(relPath.lastIndexOf('/') + 1))
      : regex.test(relPath)
}

/** 把 glob 源串翻译成正则源串；逐个字符处理，避免二次转义。 */
function toRegExpSource(pattern: string): string {
  let source = ''
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i]
    if (char === '*') {
      if (pattern[i + 1] === '*') {
        // "**/" 语义是「零或多级目录」，因此后面的 "/" 一并吞掉。
        if (pattern[i + 2] === '/') {
          source += '(?:.*/)?'
          i += 2
        } else {
          source += '.*'
          i += 1
        }
      } else {
        source += '[^/]*'
      }
      continue
    }
    if (char === '?') {
      source += '[^/]'
      continue
    }
    source += /[.+^${}()|[\]\\]/.test(char ?? '') ? `\\${char}` : char ?? ''
  }
  return source
}
