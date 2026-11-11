/**
 * verify-gallery.mjs —— 视图1（朝代主页）验收
 * ---------------------------------------------------------------------------
 * 本轮重点验证两件事：
 *
 *  A. 过渡是"渐变"还是"跳变"
 *     逐帧采样面板宽度：若浏览器把 flex-grow 从 1 直接跳到 2.6，
 *     采样只会拿到两个宽度值；平滑过渡应有十几个中间宽度，
 *     且起步平缓（easeInOutCubic 在 t=20% 时只完成约 10% 位移）。
 *
 *  B. 背景图与字体是否真的按数据分流
 *     —— 13 张背景图必须各不相同；--font-dynasty 必须按 fontStyle 解析。
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

const HOVER_INDEX = 7 // 第 8 个模块：宋

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--no-sandbox', '--force-device-scale-factor=1'],
  defaultViewport: { width: 1600, height: 900 },
})

try {
  const page = await browser.newPage()
  // 关闭缓存：public/ 下的占位图会被浏览器按启发式缓存，重跑时会拿到旧图
  await page.setCacheEnabled(false)
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.dyn-panel', { timeout: 30000 })
  await page.evaluate(() => document.fonts.ready)
  await new Promise((r) => setTimeout(r, 3200)) // 等空闲预热跑完

  /* ---------------- 静态断言 ---------------- */
  const panels = await page.$$eval('.dyn-panel', (nodes) =>
    nodes.map((n) => ({
      grow: Number(getComputedStyle(n).flexGrow),
      w: Math.round(n.getBoundingClientRect().width),
      h: Math.round(n.getBoundingClientRect().height),
      bg: getComputedStyle(n.querySelector('.dyn-media')).backgroundImage,
      font: getComputedStyle(n.querySelector('.dyn-name')).fontFamily,
      name: n.querySelector('.dyn-name')?.textContent ?? '',
    })),
  )

  check('13 个朝代模块同时挂载', panels.length === 13, `实际 ${panels.length}`)
  check('默认全部等分（flex-grow: 1）', panels.every((p) => p.grow === 1))
  check(
    '13 张背景图各不相同（各自对应器物）',
    new Set(panels.map((p) => p.bg)).size === 13,
    `distinct=${new Set(panels.map((p) => p.bg)).size}`,
  )

  const byName = Object.fromEntries(panels.map((p) => [p.name, p.font]))
  check('唐（瘦金体）→ ZCOOL XiaoWei', /ZCOOL XiaoWei/.test(byName['唐']), byName['唐'])
  check('晋（行书）→ Long Cang', /Long Cang/.test(byName['晋']), byName['晋'])
  check('秦（小篆）→ Ma Shan Zheng', /Ma Shan Zheng/.test(byName['秦']), byName['秦'])
  check('清（馆阁体）→ ZCOOL XiaoWei', /ZCOOL XiaoWei/.test(byName['清']), byName['清'])

  await page.screenshot({ path: `${OUT}\\01-gallery-default.png` })

  /* ---------------- 过渡曲线采样 ---------------- */
  const box = await page.$eval(`.dyn-panel:nth-child(${HOVER_INDEX + 1})`, (n) => {
    const r = n.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width }
  })

  // 先移开，确保处于静止态
  await page.mouse.move(5, 5, { steps: 1 })
  await new Promise((r) => setTimeout(r, 900))

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
  await new Promise((r) => setTimeout(r, 1000))
  const samples = await page.evaluate(() => window.__w)

  const ws = samples.map((s) => s[1])
  const distinct = new Set(ws).size
  const wMin = Math.min(...ws)
  const wMax = Math.max(...ws)
  const at140 = samples.find((s) => s[0] >= 140)?.[1] ?? wMax
  const progress20 = (at140 - wMin) / (wMax - wMin)

  console.log(
    `\n[WIDTH] distinct=${distinct} from=${wMin}px to=${wMax}px progress@140ms=${(progress20 * 100).toFixed(0)}%`,
  )
  check('宽度有大量中间态（渐变而非跳变）', distinct >= 10, `distinct=${distinct}`)
  check('起步平缓：140ms 时位移完成 < 40%', progress20 < 0.4, `${(progress20 * 100).toFixed(0)}%`)

  /* ---------------- 挤压数值 ---------------- */
  const after = await page.$$eval('.dyn-panel', (nodes) =>
    nodes.map((n) => ({
      grow: Number(getComputedStyle(n).flexGrow),
      w: Math.round(n.getBoundingClientRect().width),
      h: Math.round(n.getBoundingClientRect().height),
      tf: getComputedStyle(n.querySelector('.dyn-media')).transform,
    })),
  )
  const hovered = after[HOVER_INDEX]
  check('悬停项 flex-grow = 2.6', hovered.grow === 2.6, `${hovered.grow}`)
  check(
    '其余项 flex-grow = 0.8',
    after.filter((_, i) => i !== HOVER_INDEX).every((p) => p.grow === 0.8),
  )
  check('悬停项明显变宽', hovered.w > box.w * 1.8, `${Math.round(box.w)}px → ${hovered.w}px`)
  check('背景层 scale(1.05)', /matrix\(1\.05, 0, 0, 1\.05/.test(hovered.tf), hovered.tf)
  check(
    '挤压时高度不变（无布局塌陷）',
    after.every((p) => Math.abs(p.h - after[0].h) <= 1),
    `${after[0].h}px`,
  )

  const timing = await page.evaluate(() => {
    const panels = Array.from(document.querySelectorAll('.dyn-panel'))
    const activeEl = panels.find((n) => n.getAttribute('data-active') === 'true') ?? panels[0]
    const idleEl = panels[panels.length - 1]
    const a = getComputedStyle(activeEl)
    const i = getComputedStyle(idleEl)
    return {
      activeDur: a.transitionDuration,
      activeEase: a.transitionTimingFunction,
      idleDur: i.transitionDuration,
    }
  })
  check(
    '展开时长 620ms、收缩 360ms（非对称，邻居先让位）',
    timing.activeDur.includes('0.62s') && timing.idleDur.includes('0.36s'),
    `active=${timing.activeDur} idle=${timing.idleDur}`,
  )
  check(
    '展开曲线 easeInOutCubic（缓起缓收）',
    /cubic-bezier\(0\.65, 0, 0\.35, 1\)/.test(timing.activeEase),
    timing.activeEase,
  )

  await page.screenshot({ path: `${OUT}\\02-gallery-hover-song.png` })

  /* ---------------- reduce-motion 下仍保留过渡 ---------------- */
  const page2 = await browser.newPage()
  await page2.setCacheEnabled(false)
  await page2.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  await page2.setViewport({ width: 1600, height: 900 })
  await page2.goto(URL, { waitUntil: 'networkidle2' })
  await page2.waitForSelector('.dyn-panel')
  const reducedTiming = await page2.$eval('.dyn-panel', (n) => getComputedStyle(n).transitionDuration)
  check(
    '系统开启"减少动效"时仍有过渡（260ms，不再瞬间跳变）',
    parseFloat(reducedTiming) >= 0.2,
    reducedTiming,
  )
  await page2.close()

  /* ---------------- 状态机链路 ---------------- */
  await page.mouse.click(box.x, box.y)
  await new Promise((r) => setTimeout(r, 600))
  const stubTitle = await page.$eval('.phase-stub-title', (n) => n.textContent?.trim()).catch(() => null)
  check('点击朝代进入视图2', Boolean(stubTitle), `title=${stubTitle}`)
  await page.screenshot({ path: `${OUT}\\03-view2-stub.png` })

  await page.keyboard.press('Escape')
  await new Promise((r) => setTimeout(r, 500))
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
