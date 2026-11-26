/**
 * discover：静态清单 —— 列出所有可发现的 ToolFactory。
 *
 * 新增一个 tool = 在 impl/ 下加文件导出 ToolFactory + 这里 import 加一行。
 * 不需要理解 Cordis，不需要写 plugin；就写一个 (ctx) => Tool 工厂函数。
 * query_capabilities 也是普通工厂，与其他 tool 一视同仁。
 */

import { queryCapabilities } from './impl/query-capabilities.ts'
import { readFile } from './impl/read-file.ts'
import { searchFile } from './impl/search-file.ts'
import { shellExec } from './impl/shell-exec.ts'
import { understandImage } from './impl/understand-image.ts'
import type { ToolFactory } from './types.ts'

export function discoverTools(): ToolFactory[] {
  return [queryCapabilities, readFile, searchFile, shellExec, understandImage]
}
