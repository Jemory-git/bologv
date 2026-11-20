/**
 * 模型端点的通用配置。任意 OpenAI 兼容端点都能用这份结构。
 * 每个 provider（deepseek、ollama、qwen...）只需组装自己的默认值。
 */
export interface ModelConfig {
  /** API 基础地址，如 `https://api.deepseek.com/v1`。 */
  baseURL: string
  /** Bearer Token。 */
  apiKey: string
  /** 模型名，如 `deepseek-chat`、`gpt-4o`。 */
  model: string
  /** endpoint 路径，如 `/chat/completions`。 */
  path: string
}
