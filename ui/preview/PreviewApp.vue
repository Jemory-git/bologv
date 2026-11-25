<script setup lang="ts">
  /**
   * 预览窗口根组件：只认 URL 里的 path，类别由服务端响应头给出。
   *
   * 不做任何猜测：读取规则与发送引用时是同一套 inspect，
   * 因此预览里能看到的文件，就是模型实际会收到的文件。
   */
  import { onBeforeUnmount, onMounted, ref } from 'vue'
  import { referenceContentUrl } from '@ui/http/references.ts'
  import ImagePreview from './ImagePreview.vue'
  import TextPreview from './TextPreview.vue'

  /** 文本超过这个长度就截断，避免几十万行一次性排版卡住渲染进程。 */
  const MAX_TEXT_CHARS = 300_000

  //states
  const path = new URLSearchParams(window.location.search).get('path') ?? ''
  const loading = ref(true)
  const error = ref('')
  const imageUrl = ref<string | null>(null)
  const text = ref<string | null>(null)
  const truncated = ref(false)

  //methods
  async function load(): Promise<void> {
    if (path === '') {
      fail('缺少文件路径')
      return
    }

    const response = await fetch(referenceContentUrl(path)).catch(() => null)
    if (response === null) {
      fail('无法连接本地服务')
      return
    }
    if (!response.ok) {
      fail(await readError(response))
      return
    }

    // 用响应头区分类别：.json/.html 这类文档本身就是 application/json、text/html，
    // 单看 Content-Type 会和错误 envelope 混淆。
    const kind = response.headers.get('x-reference-kind')
    if (kind === null) {
      fail(await readError(response))
      return
    }

    if (kind === 'image') {
      imageUrl.value = URL.createObjectURL(await response.blob())
    } else {
      const body = await response.text()
      truncated.value = body.length > MAX_TEXT_CHARS
      text.value = truncated.value ? body.slice(0, MAX_TEXT_CHARS) : body
    }
    loading.value = false
  }

  async function readError(response: Response): Promise<string> {
    const body = (await response.json().catch(() => null)) as { msg?: string; error?: string } | null
    return body?.msg ?? body?.error ?? `读取失败（HTTP ${response.status}）`
  }

  function fail(message: string): void {
    error.value = message
    loading.value = false
  }

  //hooks
  onMounted(() => {
    void load()
  })

  onBeforeUnmount(() => {
    if (imageUrl.value !== null) URL.revokeObjectURL(imageUrl.value)
  })
</script>

<template>
  <main class="preview">
    <p v-if="loading" class="hint">正在读取…</p>
    <p v-else-if="error !== ''" class="hint error">{{ error }}</p>
    <ImagePreview v-else-if="imageUrl !== null" :src="imageUrl" />
    <TextPreview v-else-if="text !== null" :text="text" :truncated="truncated" />
  </main>
</template>

<style scoped lang="scss">
.preview {
  display: flex;
  height: 100%;
  padding: 1.6rem;
  background: var(--bg);
}

.hint {
  margin: auto;
  color: var(--muted);
  font: 1.3rem var(--mono);

  &.error {
    color: var(--fail);
  }
}
</style>
