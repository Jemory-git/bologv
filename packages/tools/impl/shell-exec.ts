/**
 * shell_exec —— 执行 shell 命令。
 *
 * 工厂函数：构造时注入 ctx，run 通过闭包使用 ctx.shell。默认 30s 超时，输出截断 20KB。
 */

import type { ToolFactory } from '../types.ts'

export const shellExec: ToolFactory = (ctx) => ({
  name: 'shell_exec',
  description: '执行 shell 命令并返回 stdout/stderr 与 exit code。适合构建、安装依赖、运行测试等。',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: '要执行的命令（不支持管道、重定向等 shell 语法）' },
      timeoutMs: { type: 'integer', description: '可选。超时毫秒数（默认 30000）' },
    },
    required: ['command'],
  },
  async run(args) {
    if (!ctx.shell) {
      return 'Tool 未配置 Shell 能力'
    }
    const command = String(args.command ?? '').trim()
    if (!command) return 'command 不能为空'

    const timeoutMs = args.timeoutMs !== undefined ? Number(args.timeoutMs) : undefined
    const result = await ctx.shell.exec(command, { timeoutMs })

    const lines = [
      `exit code: ${result.exitCode}`,
    ]
    if (result.stdout) lines.push(`--- stdout ---\n${result.stdout}`)
    if (result.stderr) lines.push(`--- stderr ---\n${result.stderr}`)
    return lines.join('\n')
  },
})
