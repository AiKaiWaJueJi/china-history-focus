/**
 * verify.mjs —— 端到端验证脚本（开发期使用，可随时删除）
 * ---------------------------------------------------------------------------
 * 用本机 Edge 无头模式打开开发服务器，做三件事：
 *   1. 断言四块容器**同时存在于 DOM**（需求：永远挂载，绝不用 display:none）；
 *   2. 断言焦点切换后，聚焦层与背景层的 computed style 精确等于需求给定数值；
 *   3. 逐步交互并截图，作为视觉证据。
 */
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const URL = process.env.APP_URL ?? 'http://localhost:5180'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = 'D:\\文档\\deepseek-harness\\default-workspace\\china-history-focus\\shots'
mkdirSync(OUT, { recursive: true })

const results = []
// blur(0px) 与 none 视觉等价，聚焦层两种写法都算合格
const isClear = (filter) => filter === 'none' || filter === 'blur(0px)'

const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' :: ' + detail : ''}`)
}

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--no-sandbox', '--force-device-scale-factor=1', '--window-size=1600,900'],
  defaultViewport: { width: 1600, height: 900 },
})

try {
  const page = await browser.newPage()
  // 无头浏览器默认上报 prefers-reduced-motion: reduce，会触发应用的无障碍降级
  // （scale→1、blur→0）。要验证真实的景深参数，必须显式声明"不要求减少动效"。
  await page.emulateMediaFeatures([
    { name: 'prefers-reduced-motion', value: 'no-preference' },
  ])
  const consoleErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(String(e)))
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('[data-layer="dynasty"]', { timeout: 30000 })
  await new Promise((r) => setTimeout(r, 900)) // 等首帧弹簧稳定

  // ---- 1) 四块容器常驻 ----
  const layers = await page.$$eval('[data-layer]', (nodes) =>
    nodes.map((n) => ({
      level: n.getAttribute('data-layer'),
      display: getComputedStyle(n).display,
      visible: n.getBoundingClientRect().width > 0,
    })),
  )
  check('四块容器同时挂载', layers.length === 4, JSON.stringify(layers.map((l) => l.level)))
  check(
    '没有任何容器使用 display:none',
    layers.every((l) => l.display !== 'none' && l.visible),
    layers.map((l) => `${l.level}:${l.display}`).join(', '),
  )

  // ---- 2) 初始态：dynasty 聚焦 ----
  const readLayer = (level) =>
    page.$eval(`[data-layer="${level}"]`, (n) => {
      const s = getComputedStyle(n)
      const m = new DOMMatrixReadOnly(s.transform === 'none' ? '' : s.transform)
      return {
        focused: n.getAttribute('data-focused') === 'true',
        opacity: Number(s.opacity),
        filter: s.filter,
        scale: Number(m.a.toFixed(3)),
        zIndex: s.zIndex,
        pointerEvents: s.pointerEvents,
        willChange: s.willChange,
        inert: n.hasAttribute('inert'),
      }
    })

  let dynasty = await readLayer('dynasty')
  let emperor = await readLayer('emperor')
  check('初始焦点在朝代层', dynasty.focused && !emperor.focused)
  check(
    '初始：朝代层 opacity=1 / blur=0 / scale=1.1 / z=50',
    dynasty.opacity === 1 && isClear(dynasty.filter) && dynasty.scale === 1.1 && dynasty.zIndex === '50',
    JSON.stringify(dynasty),
  )
  check(
    '初始：帝王层 opacity=0.4 / blur(8px) / scale=0.95 / z=10 / pointer-events=none',
    emperor.opacity === 0.4 &&
      emperor.filter === 'blur(8px)' &&
      emperor.scale === 0.95 &&
      emperor.zIndex === '10' &&
      emperor.pointerEvents === 'none',
    JSON.stringify(emperor),
  )
  check('背景层被 inert 移除 Tab 序', emperor.inert === true)

  await page.screenshot({ path: `${OUT}\\01-initial-dynasty-focus.png` })

  // ---- 3) 点击朝代「汉」，检查平级选中 ----
  const clickByText = async (selector, text) => {
    const handle = await page.evaluateHandle(
      (sel, t) => [...document.querySelectorAll(sel)].find((el) => el.textContent?.includes(t)),
      selector,
      text,
    )
    const el = handle.asElement()
    await el.click()
    return el
  }

  await clickByText('[data-layer="dynasty"] button', '汉')
  await new Promise((r) => setTimeout(r, 900))
  const afterSelect = await readLayer('dynasty')
  check('点击朝代后仍在朝代层（平级选择）', afterSelect.focused === true && afterSelect.zIndex === '50')
  const chipCount = await page.$$eval('[data-layer="dynasty"] button', (n) => n.length)
  check('朝代面板出现下钻芯片', chipCount > 5, `按钮数=${chipCount}`)
  await page.screenshot({ path: `${OUT}\\02-dynasty-selected-han.png` })

  // ---- 4) 点芯片进入 emperor 焦点：验证需求描述的核心场景 ----
  await clickByText('[data-layer="dynasty"] button', '汉高祖')
  await new Promise((r) => setTimeout(r, 1200))

  emperor = await readLayer('emperor')
  dynasty = await readLayer('dynasty')
  const event = await readLayer('event')
  const character = await readLayer('character')

  check('焦点已推进到帝王层', emperor.focused === true && !dynasty.focused)
  check(
    '帝王层（聚焦）：opacity=1 / blur(0) / scale=1.1 / z=50 / pointer-events=auto',
    emperor.opacity === 1 &&
      isClear(emperor.filter) &&
      emperor.scale === 1.1 &&
      emperor.zIndex === '50' &&
      emperor.pointerEvents === 'auto',
    JSON.stringify(emperor),
  )
  check(
    '朝代层（背景）：0.4 / blur(8px) / 0.95 / z=10 / pointer-events=none',
    dynasty.opacity === 0.4 &&
      dynasty.filter === 'blur(8px)' &&
      dynasty.scale === 0.95 &&
      dynasty.zIndex === '10' &&
      dynasty.pointerEvents === 'none',
    JSON.stringify(dynasty),
  )
  check(
    '史事层（背景）：0.4 / blur(8px) / 0.95 / z=10',
    event.opacity === 0.4 && event.filter === 'blur(8px)' && event.scale === 0.95,
    JSON.stringify(event),
  )
  check(
    '人物层（背景）：0.4 / blur(8px) / 0.95 / z=10',
    character.opacity === 0.4 && character.filter === 'blur(8px)' && character.scale === 0.95,
    JSON.stringify(character),
  )

  // 动画结束后 will-change 必须回收，否则会长期占用合成层
  check(
    '动画结束后 will-change 已回收为 auto',
    emperor.willChange === 'auto',
    `focused=${emperor.willChange} bg=${dynasty.willChange}`,
  )

  await page.screenshot({ path: `${OUT}\\03-emperor-focus.png` })

  // ---- 5) 继续下钻到 event ----
  await clickByText('[data-layer="emperor"] button', '楚汉之争')
  await new Promise((r) => setTimeout(r, 1200))
  const eventFocused = await readLayer('event')
  check('焦点可继续推进到史事层', eventFocused.focused === true && eventFocused.zIndex === '50')
  await page.screenshot({ path: `${OUT}\\04-event-focus.png` })

  // ---- 6) Esc 回退 ----
  await page.keyboard.press('Escape')
  await new Promise((r) => setTimeout(r, 1100))
  const afterBack = await readLayer('emperor')
  check('ESC 回退到上一层', afterBack.focused === true)

  // ---- 7) 控制台无报错 ----
  check('运行期间无控制台错误', consoleErrors.length === 0, consoleErrors.join(' | '))
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.pass)
console.log(`\n===== ${results.length - failed.length}/${results.length} passed =====`)
if (failed.length) {
  console.log('FAILED:')
  for (const f of failed) console.log(` - ${f.name} :: ${f.detail}`)
  process.exitCode = 1
}
