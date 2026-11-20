/**
 * 应用级健康状态：会话持久化告警。
 *
 * 纯 Pinia store。ChatView 在对话请求遇到存储错误时置位、成功时清除；
 * 状态栏告警组件常驻显示，直到下一次成功保存。
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useStatusStore = defineStore('status', () => {
  //states
  const storageError = ref<string | null>(null)

  //methods
  function setStorageError(msg: string): void {
    storageError.value = msg
  }

  function clearStorageError(): void {
    storageError.value = null
  }

  return { storageError, setStorageError, clearStorageError }
})
