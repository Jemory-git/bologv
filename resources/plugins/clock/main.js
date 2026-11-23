/**
 * 状态栏时钟 —— 演示 host.ui.registerStatusBar。
 *
 * 状态栏条目没有入口按钮，所以只需要给出 component，不需要 id/label；
 * 颜色与字号继承状态栏，不写内联样式才能跟随主题。
 * 定时器由组件自己的 onBeforeUnmount 清理：停用插件时宿主卸载条目，时钟随之消失。
 */

/** 固定 24 小时制，避免「上午/下午」后缀让状态栏宽度抖动。 */
function formatTime() {
  return new Date().toLocaleTimeString(undefined, { hour12: false })
}

export default {
  apply(host) {
    const { defineComponent, h, onBeforeUnmount, onMounted, ref } = host.vue

    const Clock = defineComponent({
      name: 'ExternalClock',
      setup() {
        const time = ref(formatTime())
        let timer

        onMounted(() => {
          timer = setInterval(() => {
            time.value = formatTime()
          }, 1000)
        })

        onBeforeUnmount(() => clearInterval(timer))

        return { time }
      },
      render() {
        return h('span', { title: '外置插件：时钟' }, this.time)
      },
    })

    host.ui.registerStatusBar({ component: Clock })
    host.log('状态栏时钟已注册')
  },
}
