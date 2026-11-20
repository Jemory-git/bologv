import { http } from './fetch.ts'
import type { ChatRequest, ChatResponse } from '../../shared/dto.ts'

export function chat(body: ChatRequest) {
  return http.post<ChatResponse>('/api/chat', body)
}
