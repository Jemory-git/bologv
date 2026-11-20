import { http } from './fetch.ts'
import type { SessionEventsResponse, SessionsListResponse } from '../../shared/dto.ts'

export function getSessions() {
  return http.get<SessionsListResponse>('/api/sessions')
}

export function getSessionEvents(id: string) {
  return http.get<SessionEventsResponse>(`/api/sessions/${id}/events`)
}
