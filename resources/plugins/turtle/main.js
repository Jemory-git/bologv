/**
 * 外置插件示例 —— 断网小乌龟。
 *
 * 这是一个完整的运行时插件：
 *   manifest.json  元信息，扫描阶段只读
 *   main.js        本文件，只有启用时才被动态 import
 *
 * 演示的能力：
 *   host.vue                用宿主注入的 Vue 运行时写组件
 *   host.ui.registerPanel   注册侧边栏面板（component 形态）
 *   host.ui.injectStyle     注入样式，停用插件时自动移除
 *   Vue 生命周期             组件卸载时取消 rAF、移除键盘监听
 *
 * 画面全部由 Canvas 绘制，不加载任何外部资源。
 */

const W = 800
const H = 220
const GROUND = 176
const BEST_KEY = 'turtle.best'
const GRAVITY = 2600
/** 按住时上升段的重力：越小升得越高。 */
const HOLD_RISE_GRAVITY = 1200
/** 按住时下落段的重力：介于上升重力与常规重力之间，按住不松手会缓缓落下。 */
const HOLD_FALL_GRAVITY = 100
const JUMP_SPEED = 620
/** 跳跃高度上限：按住到顶后不再升高，避免冲出画布。 */
const MAX_JUMP_HEIGHT = 128
/** 轻点即松手时的最小跳跃高度，保证能越过最高的仙人掌。 */
const MIN_JUMP_HEIGHT = 70
/** 松手时保留的上升速度比例，越小松手后下坠越干脆。 */
const JUMP_CUT = 0.35

const TURTLE_COLORS = {
  skin: '#8fd19e',
  skinShade: '#639f76',
  shellRim: '#2f6f52',
  shell: '#4e9f6d',
  shellPattern: '#a4c96f',
  ink: '#0f131a',
}

/** 地面碎石：固定伪随机，避免每帧闪烁。 */
const GROUND_DOTS = Array.from({ length: 56 }, (_, i) => ({
  x: (i * 131) % W,
  y: GROUND + 6 + ((i * 37) % 12),
  w: 2 + ((i * 13) % 5),
}))

const TIPS = {
  ready: '按空格 / ↑ / 点击开始；按住越久跳得越高',
  running: '空格 / ↑ / 点击跳跃；按得越久跳得越高，松手立即下落',
  over: '撞到仙人掌了，按空格或点击重新开始',
}

export default {
  apply(host) {
    const { defineComponent, h, onBeforeUnmount, onMounted, ref } = host.vue
    host.log('断网小乌龟已加载')

    const TurtlePanel = defineComponent({
      name: 'ExternalTurtlePanel',
      setup() {
        const stage = ref(null)
        const phase = ref('ready')

        let context = null
        let raf = 0
        let last = 0
        /** 跳跃键 / 指针是否处于按下状态；决定下落段用哪套重力。 */
        let holding = false

        const game = {
          distance: 0,
          score: 0,
          speed: 320,
          groundOffset: 0,
          spawnIn: 1.2,
          best: readBest(),
          turtle: { height: 0, vy: 0, onGround: true, frame: 0 },
          obstacles: [],
          clouds: [{ x: 300, y: 42 }, { x: 610, y: 72 }],
        }

        //states

        //methods

        function reset() {
          game.distance = 0
          game.score = 0
          game.speed = 320
          game.groundOffset = 0
          game.spawnIn = 1.2
          game.turtle = { height: 0, vy: 0, onGround: true, frame: 0 }
          game.obstacles = []
          game.clouds = [{ x: 300, y: 42 }, { x: 610, y: 72 }]
        }

        function start() {
          reset()
          phase.value = 'running'
        }

        function jump() {
          if (phase.value !== 'running') {
            start()
            return
          }
          const turtle = game.turtle
          if (turtle.onGround) {
            turtle.vy = JUMP_SPEED
            turtle.onGround = false
          }
        }

        function gameOver() {
          phase.value = 'over'
          if (game.score > game.best) {
            game.best = game.score
            writeBest(game.best)
          }
        }

        function spawnObstacle() {
          const count = 1 + Math.floor(Math.random() * 3)
          const height = 34 + Math.floor(Math.random() * 3) * 10
          game.obstacles.push({ x: W + 20, w: count * 14, h: height, count })
        }

        function update(dt) {
          game.speed = 320 + Math.min(280, game.score * 0.5)
          game.distance += game.speed * dt
          game.score = Math.floor(game.distance / 20)
          game.groundOffset = (game.groundOffset + game.speed * dt) % W

          const turtle = game.turtle
          if (!turtle.onGround) {
            // 按住：上升轻重力（升得高）、下落中重力（落得慢）；松手：常规重力，立刻下坠
            const gravity = holding
              ? (turtle.vy > 0 ? HOLD_RISE_GRAVITY : HOLD_FALL_GRAVITY)
              : GRAVITY
            turtle.vy -= gravity * dt
            turtle.height += turtle.vy * dt
            if (turtle.height >= MAX_JUMP_HEIGHT && turtle.vy > 0) {
              turtle.height = MAX_JUMP_HEIGHT
              turtle.vy = 0
            }
            if (turtle.height <= 0) {
              turtle.height = 0
              turtle.vy = 0
              turtle.onGround = true
            }
          }
          turtle.frame = Math.floor(game.distance / 70) % 2

          for (const cloud of game.clouds) {
            cloud.x -= game.speed * 0.18 * dt
            if (cloud.x < -60) {
              cloud.x = W + Math.random() * 200
              cloud.y = 30 + Math.random() * 60
            }
          }

          for (const obstacle of game.obstacles) obstacle.x -= game.speed * dt
          game.obstacles = game.obstacles.filter((obstacle) => obstacle.x + obstacle.w > -10)

          game.spawnIn -= dt
          if (game.spawnIn <= 0) {
            spawnObstacle()
            game.spawnIn = 0.55 + Math.random() * 0.75
          }

          const turtleBox = { x: 56, y: GROUND - turtle.height - 29, w: 42, h: 27 }
          for (const obstacle of game.obstacles) {
            const box = { x: obstacle.x + 3, y: GROUND - obstacle.h + 2, w: obstacle.w - 6, h: obstacle.h - 2 }
            if (overlap(turtleBox, box)) {
              gameOver()
              break
            }
          }
        }

        // —— 绘制 ——

        /** 侧视爬行姿态：低矮背甲、外伸头尾和前后两组交替划动的腿。 */
        function drawTurtle(x, groundY, frame, dead) {
          const colors = TURTLE_COLORS
          const stride = dead ? 0 : frame === 0 ? 2 : -2

          // 远侧腿与尾巴先绘制，让背甲自然遮住根部。
          context.fillStyle = colors.skinShade
          context.fillRect(x + 12 + stride, groundY - 8, 8, 7)
          context.fillRect(x + 28 - stride, groundY - 8, 8, 7)
          context.beginPath()
          context.moveTo(x + 5, groundY - 16)
          context.lineTo(x, groundY - 12)
          context.lineTo(x + 6, groundY - 10)
          context.closePath()
          context.fill()

          // 近侧腿贴在地面，前后错步形成爬行动画。
          context.fillStyle = colors.skin
          context.fillRect(x + 8 - stride, groundY - 6, 9, 6)
          context.fillRect(x + 31 + stride, groundY - 6, 9, 6)

          // 横向椭圆背甲压低身体重心。
          fillEllipse(x + 22, groundY - 17, 20, 13, colors.shellRim)
          fillEllipse(x + 22, groundY - 18, 16, 9, colors.shell)

          // 颈部与头部低于背甲最高点，保持趴行轮廓。
          context.fillStyle = colors.skin
          context.fillRect(x + 35, groundY - 17, 9, 8)
          fillEllipse(x + 43, groundY - 13, 7, 6, colors.skin)

          // 中央六边形甲片。
          context.strokeStyle = colors.shellPattern
          context.lineWidth = 1.5
          context.beginPath()
          context.moveTo(x + 22, groundY - 26)
          context.lineTo(x + 28, groundY - 22)
          context.lineTo(x + 28, groundY - 15)
          context.lineTo(x + 22, groundY - 11)
          context.lineTo(x + 16, groundY - 15)
          context.lineTo(x + 16, groundY - 22)
          context.closePath()
          context.stroke()

          context.strokeStyle = colors.ink
          context.fillStyle = colors.ink
          if (dead) {
            context.beginPath()
            context.moveTo(x + 44, groundY - 16)
            context.lineTo(x + 48, groundY - 12)
            context.moveTo(x + 48, groundY - 16)
            context.lineTo(x + 44, groundY - 12)
            context.stroke()
          } else {
            context.fillRect(x + 45, groundY - 15, 2, 2)
            context.beginPath()
            context.arc(x + 45, groundY - 11, 3, 0.15, 1.4)
            context.stroke()
          }
        }

        function fillEllipse(x, y, radiusX, radiusY, color) {
          context.fillStyle = color
          context.beginPath()
          context.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2)
          context.fill()
        }

        function drawCactus(obstacle) {
          const top = GROUND - obstacle.h
          context.fillStyle = '#8f9bb0'
          for (let i = 0; i < obstacle.count; i++) {
            const x = obstacle.x + i * 14
            context.fillRect(x + 4, top, 6, obstacle.h)
            context.fillRect(x - 2, top + Math.round(obstacle.h * 0.3), 4, Math.round(obstacle.h * 0.35))
            context.fillRect(x - 2, top + Math.round(obstacle.h * 0.3), 6, 4)
            context.fillRect(x + 10, top + Math.round(obstacle.h * 0.18), 4, Math.round(obstacle.h * 0.4))
            context.fillRect(x + 6, top + Math.round(obstacle.h * 0.18), 5, 4)
          }
        }

        function drawClouds() {
          context.fillStyle = '#242c3a'
          for (const cloud of game.clouds) {
            context.fillRect(cloud.x, cloud.y, 34, 3)
            context.fillRect(cloud.x + 8, cloud.y - 4, 20, 3)
          }
        }

        function drawGround() {
          context.fillStyle = '#2b3444'
          context.fillRect(0, GROUND + 1, W, 2)
          context.fillStyle = '#1f2733'
          for (const dot of GROUND_DOTS) {
            const x = ((dot.x - game.groundOffset) % W + W) % W
            context.fillRect(x, dot.y, dot.w, 2)
          }
        }

        function drawScore() {
          context.textAlign = 'right'
          context.fillStyle = '#8b93a7'
          context.font = '600 16px ui-monospace, monospace'
          context.fillText(`HI ${pad(game.best)}   ${pad(game.score)}`, W - 16, 30)
        }

        function draw() {
          if (context === null) return
          context.clearRect(0, 0, W, H)
          drawClouds()
          drawGround()
          for (const obstacle of game.obstacles) drawCactus(obstacle)
          drawTurtle(48, GROUND - game.turtle.height, game.turtle.frame, phase.value === 'over')
          drawScore()

          if (phase.value === 'over') {
            context.textAlign = 'center'
            context.fillStyle = '#dfe4ec'
            context.font = '600 22px ui-monospace, monospace'
            context.fillText('G A M E   O V E R', W / 2, H / 2 - 12)
            context.fillStyle = '#8b93a7'
            context.font = '12px ui-monospace, monospace'
            context.fillText('SPACE / CLICK TO RESTART', W / 2, H / 2 + 16)
          }
        }

        // —— 循环 ——

        function tick(now) {
          raf = requestAnimationFrame(tick)
          const dt = last === 0 ? 0 : Math.min((now - last) / 1000, 0.05)
          last = now
          if (phase.value === 'running') update(dt)
          draw()
        }

        //hooks

        function isJumpKey(event) {
          return event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW'
        }

        function onKeyDown(event) {
          if (!isJumpKey(event)) return
          event.preventDefault()
          holding = true
          // 长按会持续触发 keydown；只在首次按下时起跳，避免自动连跳
          if (!event.repeat) jump()
        }

        function onKeyUp(event) {
          if (isJumpKey(event)) holding = false
        }

        function onPointerDown() {
          holding = true
          jump()
        }

        /**
         * 松开跳跃键 / 指针移出 / 窗口失焦：结束按住状态。
         * 松手即削减剩余上升速度，顶点立刻锁定 —— 这是「按多久、跳多高」的关键；
         * 但保留足以升到最小高度的速度，保证轻点也能越过最高的仙人掌。
         */
        function releaseJump() {
          holding = false
          const turtle = game.turtle
          if (turtle.onGround || turtle.vy <= 0) return
          const floorSpeed = Math.sqrt(2 * GRAVITY * Math.max(0, MIN_JUMP_HEIGHT - turtle.height))
          turtle.vy = Math.max(turtle.vy * JUMP_CUT, floorSpeed)
        }

        onMounted(() => {
          const el = stage.value
          if (el === null) return
          const dpr = window.devicePixelRatio || 1
          el.width = W * dpr
          el.height = H * dpr
          context = el.getContext('2d')
          if (context !== null) context.scale(dpr, dpr)
          window.addEventListener('keydown', onKeyDown)
          window.addEventListener('keyup', onKeyUp)
          window.addEventListener('blur', releaseJump)
          raf = requestAnimationFrame(tick)
        })

        onBeforeUnmount(() => {
          cancelAnimationFrame(raf)
          window.removeEventListener('keydown', onKeyDown)
          window.removeEventListener('keyup', onKeyUp)
          window.removeEventListener('blur', releaseJump)
          context = null
        })

        return () => h('div', { class: 'turtle-panel' }, [
          h('canvas', {
            ref: stage,
            class: 'turtle-stage',
            onPointerdown: onPointerDown,
            onPointerup: releaseJump,
            onPointercancel: releaseJump,
            onPointerleave: releaseJump,
          }),
          h('p', { class: 'turtle-tip' }, TIPS[phase.value]),
        ])
      },
    })

    host.ui.registerPanel({
      id: 'game',
      label: '断网小乌龟',
      component: TurtlePanel,
    })

    host.ui.injectStyle(`
      /* 宿主容器用 grid 把空间全部交给面板，留白与滚动由插件自己决定。 */
      .turtle-panel {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        box-sizing: border-box;
        padding: 2.4rem 2.8rem;
        overflow-y: auto;
      }
      .turtle-stage {
        width: 100%;
        height: auto;
        border: 1px solid var(--line, #232b38);
        border-radius: 0.8rem;
        background: #0f131a;
        cursor: pointer;
        image-rendering: pixelated;
        touch-action: manipulation;
      }
      .turtle-tip {
        margin: 0;
        color: var(--muted, #8b93a7);
        font-size: 1.2rem;
        text-align: center;
      }
    `)
  },
}

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function pad(value) {
  return String(value).padStart(5, '0')
}

function readBest() {
  try {
    const raw = Number(localStorage.getItem(BEST_KEY))
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0
  } catch {
    return 0
  }
}

function writeBest(value) {
  try {
    localStorage.setItem(BEST_KEY, String(value))
  } catch {
    // 存储不可用时只丢最高分，不影响游戏
  }
}
