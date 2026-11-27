/**
 * get_system_info —— 读取本应用的自身信息（只读）。
 *
 * 回答「应用装在哪、配置和会话日志存在哪、工作目录是什么」这类问题。
 * 这些路径不授予任何读写权限：写入仍受 fs 沙箱限制在工作目录内。
 */

import type { ToolFactory } from '../types.ts'

export const getSystemInfo: ToolFactory = (ctx) => ({
  name: 'get_system_info',
  description:
    '读取本应用的自身信息：版本、安装目录、配置目录、会话日志目录、工作目录、操作系统与 Electron/Node 版本。只读，仅用于回答「应用装在哪、配置保存在哪」这类问题，不会因此获得这些目录的读写权限。',
  parameters: {
    type: 'object',
    properties: {},
  },
  run() {
    const info = ctx.systemInfo
    if (info === undefined) return 'Tool 未配置应用信息能力'

    return [
      `应用版本：${info.appVersion}`,
      `安装目录：${info.installDir}`,
      `配置目录：${info.settingsDir}`,
      `会话日志目录：${info.sessionsDir}`,
      `工作目录：${info.workingDir}`,
      `运行环境：${info.platform}/${info.arch}，Electron ${info.electronVersion}，Node ${info.nodeVersion}`,
    ].join('\n')
  },
})
