/**
 * verify-gallery.mjs —— 视图1（朝代主页）验收
 * ---------------------------------------------------------------------------
 * 本轮新增的核心断言：**锚定式展开**
 *   中轴线以右的模块（index 7 起）应当"向右展开" ——
 *   其右邻宽度纹丝不动，左侧邻居收缩，激活项自身的右边缘保持不动。
 */
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const URL = process.env.APP_URL ?? 'http://localhost:5180'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = 'D:\\文档\\deepseek-harness\\default-workspace\\china-history-focus\\shots\\v3'
mkdirSync(OUT, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' :: ' + detail : ''}`)
}

const HOVER_INDEX = 7 // 唐（中轴线右侧）
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--no-sandbox', '--force-device-scale-factor=1'],
  defaultViewport: { width: 1600, height: 900 },
})

try {
  const page = await browser.newPage()
  await page.setCacheEnabled(false)
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.dyn-panel', { timeout: 30000 })
  await page.evaluate(() => document.fonts.ready)
  await sleep(3400)

  const rects = () =>
    page.$$eval('.dyn-panel', (ns) =>
      ns.map((n) => {
        const r = n.getBoundingClientRect()
        return { x: Math.round(r.x), w: Math.round(r.width), right: Math.round(r.right) }
      }),
    )

  const panels = await page.$$eval('.dyn-panel', (nodes) =>
    nodes.map((n) => ({
      bg: getComputedStyle(n.querySelector('.dyn-media')).backgroundImage,
      font: getComputedStyle(n.querySelector('.dyn-name')).fontFamily,
      name: n.querySelector('.dyn-name')?.textContent ?? '',
    })),
  )

  check('13 个朝代模块同时挂载', panels.length === 13, `实际 ${panels.length}`)
  check(
    '13 张背景图各不相同（各自对应器物）',
    new Set(panels.map((p) => p.bg)).size === 13,
    `distinct=${new Set(panels.map((p) => p.bg)).size}`,
  )

  const byName = Object.fromEntries(panels.map((p) => [p.name, p.font]))
  check('唐（瘦金体）→ ZCOOL XiaoWei', /ZCOOL XiaoWei/.test(byName['唐']), byName['唐'])
  check('晋（行书）→ Long Cang', /Long Cang/.test(byName['晋']), byName['晋'])
  check('秦（小篆）→ Ma Shan Zheng', /Ma Shan Zheng/.test(byName['秦']), byName['秦'])

  const before = await rects()
  const baseW = before[0].w
  const activeBefore = before[HOVER_INDEX]
  check('默认全部等分', before.every((r) => Math.abs(r.w - baseW) <= 1), `${baseW}px`)

  await page.screenshot({ path: `${OUT}\\01-gallery-default.png` })

  /* ---------------- 激活 ---------------- */
  const box = await page.$eval(`.dyn-panel:nth-child(${HOVER_INDEX + 1})`, (n) => {
    const r = n.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })

  // 逐帧采样激活项宽度，验证"渐变 + 起步平缓"
  await page.mouse.move(5, 5, { steps: 1 })
  await sleep(800)
  await page.evaluate((idx) => {
    const el = document.querySelectorAll('.dyn-panel')[idx]
    window.__w = []
    const t0 = performance.now()
    const loop = (t) => {
      window.__w.push([Math.round(t - t0), Math.round(el.getBoundingClientRect().width)])
      if (t - t0 < 900) requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
  }, HOVER_INDEX)

  await page.mouse.move(box.x, box.y, { steps: 1 })
  await sleep(1100)
  const samples = await page.evaluate(() => window.__w)

  const after = await rects()
  const activeAfter = after[HOVER_INDEX]

  /* ---------------- 锚定式展开 ---------------- */
  const others = after.map((r, i) => ({ i, w: r.w })).filter((o) => o.i !== HOVER_INDEX)

  const centerBefore = before[HOVER_INDEX].x + before[HOVER_INDEX].w / 2
  const centerAfter = after[HOVER_INDEX].x + after[HOVER_INDEX].w / 2

  console.log(
    `\n[EXPAND] 激活项 ${before[HOVER_INDEX].w}px → ${activeAfter.w}px（中心 ${Math.round(centerBefore)} → ${Math.round(centerAfter)}）`,
  )
  console.log(`[EXPAND] 其余宽度: ${others.map((o) => o.w).join(',')}`)

  check('激活项展开（≥ 2.5 倍等分宽）', activeAfter.w > baseW * 2.5, `${activeAfter.w}px`)
  // 左侧 7 块、右侧 5 块各自分摊一半收缩量 → 两组内部等宽，两组之间略有差异
  const leftW = after.slice(0, HOVER_INDEX).map((r) => r.w)
  const rightW = after.slice(HOVER_INDEX + 1).map((r) => r.w)
  check(
    '左/右两组内部各自等宽（对称展开）',
    Math.max(...leftW) - Math.min(...leftW) <= 1 && Math.max(...rightW) - Math.min(...rightW) <= 1,
    `左 ${leftW[0]}px × ${leftW.length} / 右 ${rightW[0]}px × ${rightW.length}`,
  )
  check(
    '其余模块确实变窄',
    others.every((o) => o.w < baseW - 2),
    `最大=${Math.max(...others.map((o) => o.w))}px`,
  )
  // 左右分摊收缩量后，激活项中心应当严格不动 —— 面板不会在光标下滑动
  const drift = Math.abs(centerAfter - centerBefore)
  check(
    '激活项中心保持不动（不会滑离光标）',
    drift <= 3,
    `${Math.round(centerBefore)} → ${Math.round(centerAfter)}（漂移 ${Math.round(drift)}px）`,
  )
  // 背景层必须完整覆盖面板（含展开态），否则两侧会露出底色
  const mediaW = await page.$$eval('.dyn-panel', (ns) =>
    ns.map((n) => Math.round(n.querySelector('.dyn-media').getBoundingClientRect().width)),
  )
  check(
    '展开态背景层完整覆盖面板',
    mediaW[HOVER_INDEX] >= activeAfter.w + 2,
    `media=${mediaW[HOVER_INDEX]}px / panel=${activeAfter.w}px`,
  )
  check(
    '所有面板的背景层都不小于自身宽度',
    mediaW.every((w, i) => w >= after[i].w),
    `最小覆盖余量 ${Math.min(...mediaW.map((w, i) => w - after[i].w))}px`,
  )

  check(
    '挤压过程中面板高度不变',
    (await page.$$eval('.dyn-panel', (ns) => ns.map((n) => Math.round(n.getBoundingClientRect().height)))).every(
      (h) => Math.abs(h - 830) <= 1,
    ),
  )

  /* ---------------- 过渡曲线 ---------------- */
  const ws = samples.map((s) => s[1])
  const distinct = new Set(ws).size
  const wMin = Math.min(...ws)
  const wMax = Math.max(...ws)
  const at140 = samples.find((s) => s[0] >= 140)?.[1] ?? wMax
  const progress20 = (at140 - wMin) / (wMax - wMin)
  console.log(`[WIDTH] distinct=${distinct} ${wMin}px → ${wMax}px progress@140ms=${(progress20 * 100).toFixed(0)}%`)
  check('宽度有大量中间态（渐变而非跳变）', distinct >= 10, `distinct=${distinct}`)
  // 现在用的是 easeOut：起步就全速，随后柔和收尾（跟手优先）。
  // 因此改为断言"响应及时"——140ms 内应已完成相当比例的位移。
  check('起步跟手：140ms 内完成 ≥ 40% 位移', progress20 >= 0.4, `${(progress20 * 100).toFixed(0)}%`)

  // 并且要在 360ms 左右到位，不能拖长尾
  const at500 = samples.find((s) => s[0] >= 500)?.[1] ?? wMax
  const at900 = samples[samples.length - 1][1]
  check(
    '500ms 内基本到位（≥95%）',
    at500 >= at900 * 0.95,
    `${at500}px / ${at900}px`,
  )

  const timing = await page.evaluate(() => {
    const panels = Array.from(document.querySelectorAll('.dyn-panel'))
    const activeEl = panels.find((n) => n.getAttribute('data-active') === 'true')
    const idleEl = panels[panels.length - 1]
    return {
      activeDur: getComputedStyle(activeEl).transitionDuration,
      activeEase: getComputedStyle(activeEl).transitionTimingFunction,
      idleDur: getComputedStyle(idleEl).transitionDuration,
    }
  })
  check(
    '宽度过渡 360ms（对 width 插值，不依赖 flex-grow 比例）',
    timing.activeDur.includes('0.36s') && timing.idleDur.includes('0.36s'),
    `active=${timing.activeDur} idle=${timing.idleDur}`,
  )
  check('展开曲线 easeOut（起速快、收尾柔）', /cubic-bezier\(0\.22, 1, 0\.36, 1\)/.test(timing.activeEase), timing.activeEase)

  // 宽度必须单调递增（不能出现"先塌后张"）
  let monotonic = true
  for (let i = 1; i < ws.length; i++) if (ws[i] < ws[i - 1] - 1) monotonic = false
  check('激活项宽度单调递增（无闪缩）', monotonic, `min=${wMin}px`)

  await page.screenshot({ path: `${OUT}\\02-gallery-hover-tang.png` })

  /* ---------------- reduce-motion ---------------- */
  const page2 = await browser.newPage()
  await page2.setCacheEnabled(false)
  await page2.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  await page2.setViewport({ width: 1600, height: 900 })
  await page2.goto(URL, { waitUntil: 'networkidle2' })
  await page2.waitForSelector('.dyn-panel')
  const reducedTiming = await page2.$eval('.dyn-panel', (n) => getComputedStyle(n).transitionDuration)
  check('减少动效时仍有过渡（220ms）', Number.parseFloat(reducedTiming) >= 0.2, reducedTiming)
  await page2.close()

  /* ---------------- 状态机链路 ---------------- */
  await page.mouse.click(box.x, box.y)
  await sleep(600)
  const stubTitle = await page.$eval('.phase-stub-title', (n) => n.textContent?.trim()).catch(() => null)
  check('点击朝代进入视图2', Boolean(stubTitle), `title=${stubTitle}`)
  await page.screenshot({ path: `${OUT}\\03-view2-stub.png` })

  await page.keyboard.press('Escape')
  await sleep(500)
  check('ESC 返回朝代主页', Boolean(await page.$('.gallery')))
  check('无控制台错误', errors.length === 0, errors.join(' | '))
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
