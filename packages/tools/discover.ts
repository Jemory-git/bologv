/**
 * discover：静态清单 —— 列出所有可发现的 ToolFactory。
 *
 * 新增一个 tool = 在 impl/ 下加文件导出 ToolFactory + 这里 import 加一行。
 * 不需要理解 Cordis，不需要写 plugin；就写一个 (ctx) => Tool 工厂函数。
 * query_capabilities 也是普通工厂，与其他 tool 一视同仁。
 *
 * 文件能力按工作流排列：定位（find_files）→ 检索（grep_files）→ 读取（read_file）
 * → 写入（write_file / edit_file）。
 */

import { editFile } from './impl/edit-file.ts'
import { findFiles } from './impl/find-files.ts'
import { grepFiles } from './impl/grep-files.ts'
import { queryCapabilities } from './impl/query-capabilities.ts'
import { readFile } from './impl/read-file.ts'
import { shellExec } from './impl/shell-exec.ts'
import { getSystemInfo } from './impl/system-info.ts'
import { understandImage } from './impl/understand-image.ts'
import { writeFile } from './impl/write-file.ts'
import type { ToolFactory } from './types.ts'

export function discoverTools(): ToolFactory[] {
  return [
    queryCapabilities,
    findFiles,
    grepFiles,
    readFile,
    writeFile,
    editFile,
    shellExec,
    understandImage,
    getSystemInfo,
  ]
}
