<script setup lang="ts">
/**
 * 对话视图：自包含发送逻辑，状态从 Pinia store 读。
 *
 * - 历史 entries / pending：useChatStore()
 * - 选中模型：useModelsStore()，随 POST /api/chat 必传
 * - 发消息：tuple 返回无 try/catch
 *   （bridge.onEvent 推送会把本轮 events 统一填进 store，这里不关心返回值）
 */
import Header from '@ui/components/conversation/header.vue'
import Input from '@ui/components/conversation/input.vue'
import Body from '@ui/components/conversation/body.vue'
import { chat as httpChat } from '@ui/http/chat.ts'
import { useChatStore } from '@ui/stores/chat.ts'
import { useModelsStore } from '@ui/stores/models.ts'
import { useStatusStore } from '@ui/stores/status.ts'

//states
const chat = useChatStore()
const models = useModelsStore()
const status = useStatusStore()

//methods
async function send(text: string): Promise<void> {
  const value = text.trim()
  if (value === '' || chat.pending) return
  const model = models.selectedModelId
  if (model === null) {
    chat.appendError('没有可用的模型，请先在「配置模型」中添加')
    return
  }
  chat.setPending(true)
  const [err, body] = await httpChat({ text: value, model })
  if (err) {
    chat.appendError(`请求失败：${err.message}`)
  } else if (body.code !== 0) {
    chat.appendError(`请求失败：${body.msg || 'api error'}`)
    // envelope 里 errCode 500 来自 StorageError（会话持久化失败）：
    // 置位常驻告警，提醒用户保存已坏、重启会丢，先修复再继续。
    if (body.errCode === 500) status.setStorageError(body.msg || '会话保存失败')
  } else {
    status.clearStorageError()
  }
  chat.setPending(false)
}
</script>

<template>
  <section class="chat-view">
    <Header title="当前会话" :model="models.selectedModelId ?? '未配置模型'" :pending="chat.pending" />

    <Body :entries="chat.entries" :pending="chat.pending" @suggest="send($event)" />
    <Input :pending="chat.pending" @send="send($event)" />
  </section>
</template>

<style scoped lang="scss">
.chat-view {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}
</style>
