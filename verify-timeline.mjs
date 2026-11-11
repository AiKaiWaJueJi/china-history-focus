/**
 * verify-timeline.mjs —— 阶段二（帝王时间轴）验收
 * ---------------------------------------------------------------------------
 * 覆盖：
 *   1. 从主页点击「周」→ 路由跳转到 /dynasty/zhou，且主页组件未被破坏
 *   2. 一页 3 个帝王模块；滚轮翻页；冷却期内连滚不会连翻
 *   3. 悬浮：该模块聚焦、其余变暗；上下浮层出现 2-3 个事件节点
 *   4. 末页只有 1 位帝王时补空槽，卡片宽度不变
 *   5. ESC 返回主页
 */
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const URL = process.env.APP_URL ?? 'http://localhost:5180'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = 'D:\\文档\\deepseek-harness\\default-workspace\\china-history-focus\\shots\\v4'
mkdirSync(OUT, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' :: ' + detail : ''}`)
}

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

  /* ---------- 1) 主页 → 点击周 → 路由 ---------- */
  await page.goto(`${URL}/`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.dyn-panel', { timeout: 30000 })
  await page.evaluate(() => document.fonts.ready)
  await sleep(3200)

  check('主页仍正常渲染（13 个朝代模块）', (await page.$$('.dyn-panel')).length === 13)

  const zhouBox = await page.$eval('.dyn-panel:nth-child(1)', (n) => {
    const r = n.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  await page.mouse.move(zhouBox.x, zhouBox.y, { steps: 2 })
  await sleep(700)
  await page.mouse.click(zhouBox.x, zhouBox.y)
  await sleep(900)

  const url = page.url()
  check('点击朝代跳转到 /dynasty/zhou', /\/dynasty\/zhou$/.test(url), url)
  await page.waitForSelector('.emp-card', { timeout: 10000 })

  const titles = () =>
    page.$$eval('.emp-card .emp-title', (ns) => ns.map((n) => n.textContent?.trim()))

  const page1 = await titles()
  check('一页显示 3 个帝王模块', page1.length === 3, page1.join(' / '))
  check('首屏为西周开国三王', page1[0] === '周武王' && page1[2] === '周康王', page1.join(' / '))

  const countText = await page.$eval('.timeline-count', (n) => n.textContent?.trim())
  check('显示总人数与页码', /共 37 位帝王 · 第 1 \/ 13 页/.test(countText ?? ''), countText)

  await page.screenshot({ path: `${OUT}\\01-timeline-page1.png` })

  /* ---------- 2) 滚轮翻页 ---------- */
  await page.mouse.move(800, 450)
  await page.mouse.wheel({ deltaY: 220 })
  await sleep(900)
  const page2 = await titles()
  check('滚轮翻到下一页（帝王已更换）', page2[0] !== page1[0], `${page1[0]} → ${page2[0]}`)
  const countText2 = await page.$eval('.timeline-count', (n) => n.textContent?.trim())
  check('页码更新为第 2 页', /第 2 \/ 13 页/.test(countText2 ?? ''), countText2)

  // 冷却测试：快速连续滚三次，应当只翻一页
  const before = await page.$eval('.timeline-count', (n) => n.textContent?.trim())
  await page.mouse.wheel({ deltaY: 220 })
  await page.mouse.wheel({ deltaY: 220 })
  await page.mouse.wheel({ deltaY: 220 })
  await sleep(900)
  const after = await page.$eval('.timeline-count', (n) => n.textContent?.trim())
  const pageOf = (s) => Number(/第 (\d+) \//.exec(s ?? '')?.[1] ?? 0)
  check(
    '冷却期内连滚只翻一页（无连翻）',
    pageOf(after) - pageOf(before) === 1,
    `${pageOf(before)} → ${pageOf(after)}`,
  )

  /* ---------- 3) 悬浮：聚焦 / 变暗 / 浮层 ---------- */
  const cardBox = await page.$eval('.emp-card:nth-child(2)', (n) => {
    const r = n.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  await page.mouse.move(cardBox.x, cardBox.y, { steps: 2 })
  await sleep(900)

  const styles = await page.$$eval('.emp-card', (ns) =>
    ns.map((n) => ({
      opacity: Number(getComputedStyle(n).opacity),
      media: getComputedStyle(n.querySelector('.emp-media')).transform,
      events: Array.from(n.querySelectorAll('.emp-event')).map((e) => ({
        opacity: Number(getComputedStyle(e).opacity),
        name: e.querySelector('.emp-event-name')?.textContent,
        side: e.closest('.emp-events--top') ? 'top' : 'bottom',
      })),
    })),
  )

  const hovered = styles[1]
  const others = [styles[0], styles[2]]
  check('悬浮模块保持完全不透明', hovered.opacity === 1, `${hovered.opacity}`)
  check(
    '其余两个模块变暗',
    others.every((o) => o.opacity < 0.5),
    others.map((o) => o.opacity).join(' / '),
  )
  check(
    '悬浮时背景放大到 scale(1.05)',
    /matrix\(1\.05, 0, 0, 1\.05/.test(hovered.media),
    hovered.media,
  )

  const visibleEvents = hovered.events.filter((e) => e.opacity > 0.9)
  check('浮层出现 2-3 个事件节点', visibleEvents.length >= 2 && visibleEvents.length <= 3, visibleEvents.map((e) => e.name).join(' / '))
  check(
    '事件节点分布在模块上下两侧',
    visibleEvents.some((e) => e.side === 'top') && visibleEvents.some((e) => e.side === 'bottom'),
    visibleEvents.map((e) => `${e.side}:${e.name}`).join(' / '),
  )

  await page.screenshot({ path: `${OUT}\\02-timeline-hover.png` })

  // 移开后浮层淡出
  await page.mouse.move(800, 60, { steps: 2 })
  await sleep(700)
  const collapsed = await page.$$eval('.emp-card .emp-event', (ns) =>
    ns.map((n) => Number(getComputedStyle(n).opacity)),
  )
  check('移开后浮层淡出', collapsed.every((o) => o < 0.2), `max=${Math.max(...collapsed)}`)

  /* ---------- 4) 末页：1 位帝王 + 2 个空槽 ---------- */
  // 直接跳到最后一页
  for (let i = 0; i < 20; i++) {
    await page.mouse.wheel({ deltaY: 220 })
    await sleep(560)
    const text = await page.$eval('.timeline-count', (n) => n.textContent?.trim())
    if (/第 13 \/ 13 页/.test(text ?? '')) break
  }
  // 等退出动画彻底结束再测量（AnimatePresence mode="wait" 的旧页在退出期间仍挂载）
  await sleep(1400)
  const lastPage = await page.$$eval('.emp-card', (ns) => ns.length)
  const slots = await page.$$eval('.emp-slot', (ns) => ns.length)
  const lastW = await page.$$eval('.emp-card, .emp-slot', (ns) =>
    ns.map((n) => Math.round(n.getBoundingClientRect().width)),
  )
  check('末页仅 1 位帝王 + 2 个空槽', lastPage === 1 && slots === 2, `cards=${lastPage} slots=${slots}`)
  check(
    '末页卡片宽度与其它页一致（±2px 容差）',
    Math.max(...lastW) - Math.min(...lastW) <= 2,
    lastW.join(' / '),
  )
  const lastTitle = (await titles()).join('')
  check('末页为周赧王', lastTitle === '周赧王', lastTitle)
  await page.screenshot({ path: `${OUT}\\03-timeline-last.png` })

  /* ---------- 5) ESC 返回 ---------- */
  await page.keyboard.press('Escape')
  await sleep(700)
  check('ESC 返回朝代主页', /\/$/.test(page.url()) && Boolean(await page.$('.dyn-panel')), page.url())

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
