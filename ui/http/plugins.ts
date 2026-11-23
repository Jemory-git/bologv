import { http } from './fetch.ts'
import type {
  ExternalPluginsResponse,
  PluginSettingsPutRequest,
  PluginSettingsPutResponse,
  PluginSettingsResponse,
} from '../../shared/dto.ts'

export function getPluginSettings() {
  return http.get<PluginSettingsResponse>('/api/settings/plugins')
}

export function setPluginSettings(body: PluginSettingsPutRequest) {
  return http.put<PluginSettingsPutResponse>('/api/settings/plugins', body)
}

/** 外置插件清单 + 插件目录：扫描阶段只读 manifest，不加载代码。 */
export function getExternalPlugins() {
  return http.get<ExternalPluginsResponse>('/api/plugins')
}
