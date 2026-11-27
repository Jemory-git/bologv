/**
 * 应用目录布局：所有 app.getPath / getAppPath 派生路径的唯一出处。
 *
 * 集中理由：这些路径分别决定「配置写哪、会话存哪、插件从哪读、模型能看到哪」。
 * 散落在 boot / storage / plugins / electron 各处时，改一处极易漏另一处
 * （例如 resources/plugins 曾在 catalog 与 plugins-watch 各算一遍）。
 *
 * 边界：只做路径推导，不创建目录、不读文件；目录创建由使用方按需执行。
 * 当前生效的工作目录不在这里——那是配置解析结果（见 service/storage/system.ts）。
 */

import { join } from 'node:path'
import { app } from 'electron'

const userDataDir = app.getPath('userData')
const installDir = app.getAppPath()

export const APP_PATHS = {
  /** 应用安装目录；开发态为项目根。 */
  installDir,
  /** 用户数据根目录（应用私有，安装目录保持只读）。 */
  userDataDir,
  /** 配置目录：models / tools / plugins / system 等 JSON。 */
  settingsDir: join(userDataDir, 'settings'),
  /** 会话日志根目录：每个会话一个子目录。 */
  sessionsDir: join(userDataDir, 'sessions'),
  /** 用户自行安装的外置插件目录。 */
  userPluginsDir: join(userDataDir, 'plugins'),
  /** 随应用分发的示例插件目录；打包后位于 asar 内。 */
  bundledPluginsDir: join(installDir, 'resources', 'plugins'),
  /**
   * 默认工作目录：无配置时的回退值，不代表当前生效目录。
   * 生效值由 resolveWorkingDir() 推导（配置优先）。
   */
  defaultWorkingDir: join(app.getPath('documents'), 'bologv'),
} as const

export type AppPaths = typeof APP_PATHS
