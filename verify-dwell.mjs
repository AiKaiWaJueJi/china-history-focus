/**
 * verify-dwell.mjs —— 验证"指针停留判定"是否生效
 * ---------------------------------------------------------------------------
 * 要证明的命题：鼠标快速穿越多个模块时，中间的模块**完全不启动动画**；
 * 只有当指针在某个模块上停住（>140ms），挤压才开始。
 *
 * 测法：
 *   1) 快速横扫：60 步从最左扫到最右，再移出舞台。若 dwell 生效，
 *      全程没有任何模块进入过渡，500ms 后所有宽度应仍等于默认值。
 *   2) 定点停留：把指针移到「唐」，逐帧采样宽度。前 140ms 宽度必须不变，
 *      之后才开始增长，最终到达展开宽度。
 */
import puppeteer from 'puppeteer-core'

const URL = process.env.APP_URL ?? 'http://localhost:5180'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const HOVER_INDEX = 7 // 唐

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

try {
  const page = await browser.newPage()
  await page.setCacheEnabled(false)
  // 系统动画已打开，这里模拟"无偏好"的正常用户环境
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.dyn-panel')
  await page.evaluate(() => document.fonts.ready)
  await new Promise((r) => setTimeout(r, 3200))

  const widths = () =>
    page.$$eval('.dyn-panel', (ns) => ns.map((n) => Math.round(n.getBoundingClientRect().width)))

  const base = await widths()
  const baseW = base[0]
  console.log(`[BASE] 默认宽度 = ${baseW}px × ${base.length}`)

  /* ---------- 1) 快速横扫 ---------- */
  await page.mouse.move(15, 500, { steps: 2 })
  // 60 步快速穿过 13 个模块，全部在几毫秒内完成（远小于 140ms 阈值）
  await page.mouse.move(1585, 500, { steps: 60 })
  // 立刻移出舞台，避免指针停在同一块上触发它
  await page.mouse.move(800, 12, { steps: 2 })
  await new Promise((r) => setTimeout(r, 600))

  const afterSweep = await widths()
  const maxDelta = Math.max(...afterSweep.map((w, i) => Math.abs(w - base[i])))
  console.log(`[SWEEP] 横扫后最大偏差 = ${maxDelta}px`)
  check(
    '快速横扫后所有模块宽度未变（中间态被跳过）',
    maxDelta <= 2,
    `maxDelta=${maxDelta}px  widths=${afterSweep.join(',')}`,
  )

  /* ---------- 2) 定点停留：逐帧采样 ---------- */
  const box = await page.$eval(`.dyn-panel:nth-child(${HOVER_INDEX + 1})`, (n) => {
    const r = n.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })

  await page.evaluate((idx) => {
    const el = document.querySelectorAll('.dyn-panel')[idx]
    window.__s = []
    const t0 = performance.now()
    const loop = (t) => {
      window.__s.push([Math.round(t - t0), Math.round(el.getBoundingClientRect().width)])
      if (t - t0 < 1400) requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
  }, HOVER_INDEX)

  await page.mouse.move(box.x, box.y, { steps: 1 })
  await new Promise((r) => setTimeout(r, 1500))
  const samples = await page.evaluate(() => window.__s)

  // dwell 窗口内（0-140ms）宽度必须保持默认
  const inDwell = samples.filter((s) => s[0] <= 130)
  const dwellMax = inDwell.length ? Math.max(...inDwell.map((s) => s[1])) : baseW
  const final = samples[samples.length - 1][1]

  console.log(
    `[DWELL] 0-130ms 最大宽度 = ${dwellMax}px，最终宽度 = ${final}px，样本数 = ${samples.length}`,
  )
  check('停留阈值内（0-130ms）没有启动动画', dwellMax <= baseW + 2, `${dwellMax}px vs base ${baseW}px`)
  check('停留后正常展开', final > baseW * 1.8, `${final}px`)

  // 过渡延迟确实挂在了 flex-grow 上
  const delay = await page.$eval('.dyn-panel', (n) => getComputedStyle(n).transitionDelay)
  check('transition-delay 生效', /0\.14s/.test(delay), delay)

  /* ---------- 3) 慢速移动仍能触发（阈值不能过高） ---------- */
  await page.mouse.move(15, 500, { steps: 2 })
  await new Promise((r) => setTimeout(r, 900))
  const box2 = await page.$eval('.dyn-panel:nth-child(3)', (n) => {
    const r = n.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  await page.mouse.move(box2.x, box2.y, { steps: 1 })
  await new Promise((r) => setTimeout(r, 1200))
  const slow = await widths()
  check('正常悬停仍能展开（阈值不过高）', slow[2] > baseW * 1.8, `${slow[2]}px`)

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
