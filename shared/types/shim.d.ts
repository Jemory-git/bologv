/**
 * 资源模块 shim：让 TypeScript 认识非代码资源的 import。
 *
 * .md 由 esbuild 的 text loader 烘焙进 bundle，这里只声明其默认导出为字符串。
 * 注意：本文件必须是纯脚本（无顶层 import/export），通配符环境模块声明才能全局生效；
 * 一旦变成模块，declare module '*.md' 会被当作 augmentation 而失效。
 */

declare module '*.md' {
  const content: string
  export default content
}
