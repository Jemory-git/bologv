/**
 * 模型端点的通用传输配置：协议无关。
 * 认证方式、body 形状由各协议适配器决定，这里只描述「往哪发」。
 */
export interface ModelConfig {
  /** API 基础地址，如 `https://api.deepseek.com/v1`。 */
  baseURL: string
  /** API 密钥原文；如何放进 headers 由调用方（协议适配器）决定。 */
  apiKey: string
  /** endpoint 路径，如 `/chat/completions`。 */
  path: string
}
