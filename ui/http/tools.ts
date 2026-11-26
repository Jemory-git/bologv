import { http } from './fetch.ts'
import type {
  ToolCatalogResponse,
  ToolSettingsPutRequest,
  ToolSettingsPutResponse,
  ToolSettingsResponse,
} from '../../shared/dto.ts'

export function getToolCatalog() {
  return http.get<ToolCatalogResponse>('/api/tools')
}

export function getToolSettings() {
  return http.get<ToolSettingsResponse>('/api/tools/settings')
}

export function putToolSettings(body: ToolSettingsPutRequest) {
  return http.put<ToolSettingsPutResponse>('/api/tools/settings', body)
}
