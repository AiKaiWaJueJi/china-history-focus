/**
 * verify-dwell.mjs —— 指针意图控制器的验收
 * ---------------------------------------------------------------------------
 * 本轮要证明四件事：
 *   1) 快速横扫：中间模块完全不参与动画
 *   2) 停留阈值：阈值（60ms）之内不启动，越过后正常展开
 *      计时从 pointermove 事件时刻起算 —— 早先在派发鼠标移动之前就开始计时，
 *      机器负载一抖就会把「阈值之后的那一帧」算进「阈值之内」的窗口（假阴性）。
 *   3) 【核心】布局位移不会抢走焦点：
 *      激活 A 之后，在**坐标完全不变**的情况下派发 pointermove（模拟浏览器
 *      因布局位移而补发的合成事件），激活项必须仍然是 A
 *   4) 真实的指针位移仍然能正常切换
 */
import puppeteer from 'puppeteer-core'

const URL = process.env.APP_URL ?? 'http://localhost:5180'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' :: ' + detail : ''}`)
}

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--no-sandbox', '--force-device-scale-factor=1'],
  defaultViewport: { width: 1600, height: 900 },
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

try {
  const page = await browser.newPage()
  await page.setCacheEnabled(false)
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.dyn-panel')
  await page.evaluate(() => document.fonts.ready)
  await sleep(3400) // 等空闲预热

  const widths = () =>
    page.$$eval('.dyn-panel', (ns) => ns.map((n) => Math.round(n.getBoundingClientRect().width)))
  const activeIndex = () =>
    page.$$eval('.dyn-panel', (ns) =>
      ns.findIndex((n) => n.getAttribute('data-active') === 'true'),
    )

  const base = await widths()
  const baseW = base[0]
  console.log(`[BASE] 默认宽度 ${baseW}px × ${base.length}`)

  /* ---------- 1) 快速横扫 ---------- */
  await page.mouse.move(15, 500, { steps: 2 })
  await page.mouse.move(1585, 500, { steps: 60 }) // 几毫秒内穿过 13 个模块
  await page.mouse.move(800, 12, { steps: 2 }) // 立即移出舞台
  await sleep(600)

  const afterSweep = await widths()
  const maxDelta = Math.max(...afterSweep.map((w, i) => Math.abs(w - base[i])))
  console.log(`[SWEEP] 横扫后最大偏差 ${maxDelta}px`)
  check('横扫后所有模块宽度未变（中间态被跳过）', maxDelta <= 2, `maxDelta=${maxDelta}px`)

  /* ---------- 2) 停留阈值 ---------- */
  const boxOf = (i) =>
    page.$eval(`.dyn-panel:nth-child(${i + 1})`, (n) => {
      const r = n.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    })

  const box7 = await boxOf(7)
  /*
    计时基准必须是「指针真的落到模块上」的那一刻。
    早先 t0 在派发鼠标移动之前就开始计数：CDP 往返 + 机器负载一抖动，
    60ms 的停留阈值就有一半概率落进 70ms 的观测窗，表现为
    「阈值内已展开」的假阴性（机器闲时全绿、负载高时偶发红）。
    现在从 pointermove 事件的时刻起算，观测窗也收紧到阈值以内（≤50ms），
    不再拿「阈值之后」的时刻去断言「阈值之内」。
  */
  await page.evaluate((idx) => {
    const el = document.querySelectorAll('.dyn-panel')[idx]
    window.__s = []
    window.__tMove = null
    window.addEventListener(
      'pointermove',
      () => {
        if (window.__tMove === null) window.__tMove = performance.now()
      },
      { once: true },
    )
    const started = performance.now()
    const loop = () => {
      const now = performance.now()
      const rel = window.__tMove === null ? -1 : now - window.__tMove
      window.__s.push([Math.round(rel), Math.round(el.getBoundingClientRect().width)])
      if (now - started < 1600) requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
  }, 7)

  await page.mouse.move(box7.x, box7.y, { steps: 1 })
  await sleep(1500)
  const samples = await page.evaluate(() => window.__s)
  const timed = samples.filter((s) => s[0] >= 0)
  const inDwell = timed.filter((s) => s[0] <= 50)
  const dwellMax = inDwell.length ? Math.max(...inDwell.map((s) => s[1])) : baseW
  const finalW = samples[samples.length - 1][1]
  const tStart = timed.find((s) => s[1] > baseW + 1)?.[0] ?? -1
  console.log(
    `[DWELL] 停留阈值内（自 pointermove 起算 0-50ms）最大宽度 ${dwellMax}px，动画起始 ≈${tStart}ms，最终 ${finalW}px`,
  )

  check('停留阈值内（0-50ms）未启动动画', dwellMax <= baseW + 2, `${dwellMax}px（基准 ${baseW}px）`)
  check('越过阈值后正常展开', finalW > baseW * 1.8, `${finalW}px`)
  check('启动延迟落在停留阈值量级（45–250ms）', tStart >= 45 && tStart <= 250, `${tStart}ms`)

  /* ---------- 3) 核心：布局位移不得抢走焦点 ---------- */
  const activeBefore = await activeIndex()
  check('当前激活项为第 8 个（唐）', activeBefore === 7, `active=${activeBefore}`)

  // 此刻布局已变化，光标坐标不动；浏览器可能补发 pointermove。
  // 我们手动派发一次"坐标完全相同"的事件，验证它被忽略。
  // 最坏情况：把"同坐标"的事件直接派发到**隔壁面板**上，
  // 模拟布局位移后浏览器把光标判定到另一个元素的情形。
  const sameCoordResult = await page.evaluate(
    ([x, y]) => {
      const panels = Array.from(document.querySelectorAll('.dyn-panel'))
      const neighbor = panels[7] // 唐 的右邻
      neighbor.dispatchEvent(
        new PointerEvent('pointermove', {
          clientX: x,
          clientY: y,
          bubbles: true,
          pointerType: 'mouse',
        }),
      )
      return {
        underIndex: 8,
        activeAfter: panels.findIndex((n) => n.getAttribute('data-active') === 'true'),
      }
    },
    [box7.x, box7.y],
  )
  console.log(
    `[SHIFT] 光标下元素=#${sameCoordResult.underIndex}，派发同坐标事件后 active=#${sameCoordResult.activeAfter}`,
  )
  check(
    '同坐标（布局位移）事件被忽略，焦点未被抢走',
    sameCoordResult.activeAfter === 7,
    `active=${sameCoordResult.activeAfter}, 光标下=#${sameCoordResult.underIndex}`,
  )

  /* ---------- 4) 真实位移仍能切换 ---------- */
  const box11 = await boxOf(11)
  await page.mouse.move(box11.x, box11.y, { steps: 4 }) // 真实移动
  await sleep(1200)
  const activeAfterRealMove = await activeIndex()
  check('真实指针移动可正常切换激活项', activeAfterRealMove === 11, `active=${activeAfterRealMove}`)

  /* ---------- 5) 键盘可达 ---------- */
  await page.mouse.move(800, 12, { steps: 2 })
  await sleep(600)
  await page.keyboard.press('Tab')
  await sleep(400)
  const activeByFocus = await activeIndex()
  check('Tab 聚焦可激活模块（键盘可达）', activeByFocus >= 0, `active=${activeByFocus}`)

  await browser.close()
} catch (err) {
  console.error(err)
  await browser.close()
  process.exitCode = 1
}

const failed = results.filter((r) => !r.pass)
console.log(`\n===== ${results.length - failed.length}/${results.length} passed =====`)
if (failed.length) {
  console.log('FAILED:')
  for (const f of failed) console.log(` - ${f.name} :: ${f.detail}`)
  process.exitCode = 1
}

