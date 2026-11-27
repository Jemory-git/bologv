import { http } from './fetch.ts'
import type {
  ModelsPutRequest,
  ModelsPutResponse,
  ModelsResponse,
  WorkspaceSettingsPutRequest,
  WorkspaceSettingsPutResponse,
  WorkspaceSettingsResponse,
} from '../../shared/dto.ts'

export function getVendors() {
  return http.get<ModelsResponse>('/api/models')
}

export function setVendors(body: ModelsPutRequest) {
  return http.put<ModelsPutResponse>('/api/models', body)
}

export function getWorkspace() {
  return http.get<WorkspaceSettingsResponse>('/api/settings/workspace')
}

export function setWorkspace(body: WorkspaceSettingsPutRequest) {
  return http.put<WorkspaceSettingsPutResponse>('/api/settings/workspace', body)
}
