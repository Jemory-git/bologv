/**
 * 本地参考文件检查。
 *
 * 应用与文件都在本机：只记录绝对路径与元信息，不复制原文件，
 * 因此不会出现同一份文件在应用目录里多存一份的问题。
 * 文件内容在发送/投影时按需读取；文件被移动或删除后给出明确提示。
 */

import { readFile, stat } from 'node:fs/promises'
import { basename, extname, isAbsolute, resolve } from 'node:path'
import type { ReferenceKind, ReferenceMeta } from '@pkg/session'
import { ValidationError } from '../errors.ts'

const MAX_BYTES = 20 * 1024 * 1024

const KIND_LABEL = {
  doc: '文档',
  image: '图片',
  audio: '音频',
  video: '视频',
} as const

const IMAGE_MIMES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

const DOC_MIMES: Record<string, string> = {
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',
  '.json': 'application/json',
  '.csv': 'text/csv',
  '.tsv': 'text/tab-separated-values',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.xml': 'application/xml',
  '.yaml': 'application/yaml',
  '.yml': 'application/yaml',
  '.css': 'text/css',
  '.scss': 'text/x-scss',
}

const DOC_EXTS = new Set([
  '.txt', '.md', '.markdown', '.json', '.csv', '.tsv',
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue',
  '.css', '.scss', '.less', '.html', '.htm', '.xml',
  '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf',
  '.log', '.sql', '.py', '.go', '.rs', '.java',
  '.c', '.h', '.cpp', '.hpp', '.sh', '.ps1',
])
const AUDIO_EXTS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'])
const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov', '.mkv', '.avi'])

export interface ReferenceInspectionError {
  path: string
  message: string
}

export interface ReferenceInspection {
  references: ReferenceMeta[]
  /** 单个文件失败不影响其他文件；UI 逐条提示。 */
  errors: ReferenceInspectionError[]
}

/** 批量检查；按路径去重，失败项单独返回。 */
export async function inspectReferencePaths(paths: readonly string[]): Promise<ReferenceInspection> {
  const references: ReferenceMeta[] = []
  const errors: ReferenceInspectionError[] = []
  const seen = new Set<string>()

  for (const path of paths) {
    try {
      const reference = await inspectReferencePath(path)
      if (seen.has(reference.path)) continue
      seen.add(reference.path)
      references.push(reference)
    } catch (error) {
      errors.push({ path, message: error instanceof Error ? error.message : String(error) })
    }
  }
  return { references, errors }
}

/** 检查单个路径：必须是存在的绝对文件路径，且类别当前可处理。 */
export async function inspectReferencePath(input: string): Promise<ReferenceMeta> {
  const raw = input.trim()
  if (raw === '' || !isAbsolute(raw)) {
    throw new ValidationError(`必须使用绝对路径：${raw || '(空)'}`)
  }

  const path = resolve(raw)
  const info = await stat(path).catch(() => null)
  if (info === null) throw new ValidationError(`文件不存在：${path}`)
  if (!info.isFile()) throw new ValidationError(`不是文件：${path}`)
  if (info.size === 0) throw new ValidationError(`文件为空：${path}`)
  if (info.size > MAX_BYTES) throw new ValidationError('文件超过 20MB 上限')

  const name = basename(path)
  const kind = classifyReference(name)
  if (kind === null) throw new ValidationError(`不支持的文件类型：${name}`)
  if (kind === 'audio' || kind === 'video') {
    throw new ValidationError(`暂不支持${KIND_LABEL[kind]}参考文件：${name}`)
  }
  if (kind === 'doc' && !DOC_EXTS.has(extname(name).toLowerCase())) {
    throw new ValidationError(`暂不支持该文档格式：${name}（当前支持文本类文档）`)
  }
  // 文本类文档在检查阶段就确认可按 UTF-8 读取，避免发送时才失败。
  if (kind === 'doc') {
    const buffer = await readFile(path).catch(() => null)
    if (buffer === null || buffer.includes(0)) {
      throw new ValidationError(`无法按文本读取：${name}`)
    }
  }

  return { path, kind, name, mime: mimeOf(name, kind), size: info.size }
}

/** 按扩展名判定类别；未知类型返回 null。 */
function classifyReference(name: string): ReferenceKind | null {
  const ext = extname(name).toLowerCase()
  if (IMAGE_MIMES[ext] !== undefined) return 'image'
  if (AUDIO_EXTS.has(ext)) return 'audio'
  if (VIDEO_EXTS.has(ext)) return 'video'
  if (DOC_EXTS.has(ext)) return 'doc'
  return null
}

function mimeOf(name: string, kind: ReferenceKind): string {
  const ext = extname(name).toLowerCase()
  if (kind === 'image') return IMAGE_MIMES[ext] ?? 'application/octet-stream'
  return DOC_MIMES[ext] ?? 'text/plain'
}

/** 按路径读取文本；文件缺失或不是文本时返回 null。 */
export async function readReferenceText(reference: ReferenceMeta): Promise<string | null> {
  const buffer = await readFile(reference.path).catch(() => null)
  if (buffer === null || buffer.includes(0)) return null
  return buffer.toString('utf-8')
}

/** 按路径读取图片字节；文件缺失时返回 null。 */
export async function readReferenceData(reference: ReferenceMeta): Promise<Buffer | null> {
  return readFile(reference.path).catch(() => null)
}
