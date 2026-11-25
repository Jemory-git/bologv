
export default {
  apply(host) {
    host.ui.registerStatusBar({
      mount(el) {
        el.innerText = 'Example '
      }
    })
  },
}
