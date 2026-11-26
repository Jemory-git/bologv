/**
 * 参考文件图标映射：只决定卡片上画什么图标，不参与任何处理决策。
 *
 * 先按扩展名细分（文本 / 数据 / 代码），再按类别兜底；
 * 音频、视频暂未接入发送链路，但图标先备好，避免以后再加一层分支。
 */

import IconCode from '~icons/icon-park-outline/code'
import IconDocDetail from '~icons/icon-park-outline/doc-detail'
import IconFileText from '~icons/icon-park-outline/file-text'
import IconMusic from '~icons/icon-park-outline/music'
import IconPicture from '~icons/icon-park-outline/picture'
import IconVideo from '~icons/icon-park-outline/video'

import type { Component } from 'vue'
import type { ReferenceKind } from '@pkg/session/references.ts'

const TEXT_EXTS = new Set(['.txt', '.md', '.markdown', '.log'])

const DATA_EXTS = new Set([
  '.json', '.csv', '.tsv', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.xml',
])

const KIND_ICONS: Record<ReferenceKind, Component> = {
  doc: IconFileText,
  image: IconPicture,
  audio: IconMusic,
  video: IconVideo,
}

export function referenceIcon(name: string, kind: ReferenceKind): Component {
  if (kind !== 'doc') return KIND_ICONS[kind]

  const ext = extensionOf(name)
  if (TEXT_EXTS.has(ext)) return IconFileText
  if (DATA_EXTS.has(ext)) return IconDocDetail
  return IconCode
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot).toLowerCase()
}
