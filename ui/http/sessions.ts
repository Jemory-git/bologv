import { http } from './fetch.ts'
import type {
  SessionCreateResponse,
  SessionDeleteResponse,
  SessionEventsResponse,
  SessionRenameResponse,
  SessionsListResponse,
} from '../../shared/dto.ts'

export function getSessions() {
  return http.get<SessionsListResponse>('/api/sessions')
}

export function createSession() {
  return http.post<SessionCreateResponse>('/api/sessions', {})
}

export function getSessionEvents(id: string) {
  return http.get<SessionEventsResponse>(`/api/sessions/${id}/events`)
}

export function renameSession(id: string, title: string) {
  return http.patch<SessionRenameResponse>(`/api/sessions/${id}`, { title })
}

export function deleteSession(id: string) {
  return http.delete<SessionDeleteResponse>(`/api/sessions/${id}`)
}
