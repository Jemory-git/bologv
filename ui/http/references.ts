/**
 * 参考文件检查与预览内容地址。
 * 本地应用只提交绝对路径，服务端读取元信息或内容，不复制文件。
 */

import { appFetch } from './fetch.ts'
import type { InspectReferencesResponse } from '../../shared/dto.ts'

export function inspectReferences(paths: string[]) {
  return appFetch<InspectReferencesResponse>({
    url: '/api/references/inspect',
    method: 'POST',
    body: { paths },
  })
}

/**
 * 预览窗口消费的原始内容地址。
 * 图片走 blob、文本走 fetch().text()，因此不做 JSON envelope 包装。
 */
export function referenceContentUrl(path: string): string {
  const url = new URL('/api/references/content', window.location.origin)
  url.searchParams.set('path', path)
  return url.toString()
}
