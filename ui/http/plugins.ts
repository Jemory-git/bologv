import { http } from './fetch.ts'
import type { PluginSettingsPutRequest, PluginSettingsPutResponse, PluginSettingsResponse } from '../../shared/dto.ts'

export function getPluginSettings() {
  return http.get<PluginSettingsResponse>('/api/settings/plugins')
}

export function setPluginSettings(body: PluginSettingsPutRequest) {
  return http.put<PluginSettingsPutResponse>('/api/settings/plugins', body)
}
