import { http } from './fetch.ts'
import type { ModelsPutRequest, ModelsPutResponse, ModelsResponse } from '../../shared/dto.ts'

export function getVendors() {
  return http.get<ModelsResponse>('/api/models')
}

export function setVendors(body: ModelsPutRequest) {
  return http.put<ModelsPutResponse>('/api/models', body)
}
