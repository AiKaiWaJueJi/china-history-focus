/**
 * verify-timeline.mjs —— 阶段二（帝王时间轴）验收
 * ---------------------------------------------------------------------------
 * 本轮新增关注点：
 *   1. 翻页不再是"旧页完全退出后才进新页"——过渡期间两页应同时存在（无黑场）
 *   2. 文字不再发虚：悬浮时 .emp-card 不能有非整数缩放（transform 应为 none）
 *   3. 事件按维度分组：上半区全是 military，下半区全是 political/culture
 *   4. 字号放大：姓名 ≥14px、事件名 ≥13px
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

  /* ---------- 从主页进入 ---------- */
  await page.goto(`${URL}/`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.dyn-panel', { timeout: 30000 })
  await page.evaluate(() => document.fonts.ready)
  await sleep(3200)

  check('主页仍正常渲染（12 个朝代模块）', (await page.$$('.dyn-panel')).length === 12)

  const zhouBox = await page.$eval('.dyn-panel:nth-child(1)', (n) => {
    const r = n.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  await page.mouse.move(zhouBox.x, zhouBox.y, { steps: 2 })
  await sleep(700)
  await page.mouse.click(zhouBox.x, zhouBox.y)
  await sleep(900)

  check('点击朝代跳转到 /dynasty/zhou', /\/dynasty\/zhou$/.test(page.url()), page.url())
  await page.waitForSelector('.emp-card', { timeout: 10000 })

  const titles = () => page.$$eval('.emp-card .emp-title', (ns) => ns.map((n) => n.textContent?.trim()))
  const page1 = await titles()
  check('一页显示 3 个帝王模块', page1.length === 3, page1.join(' / '))
  check('首屏为西周开国三王', page1[0] === '周武王' && page1[2] === '周康王', page1.join(' / '))

  /* ---------- 悬浮周武王：分组 / 字号 / 清晰度 ---------- */
  const card1 = await page.$eval('.emp-card:nth-child(1)', (n) => {
    const r = n.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  await page.mouse.move(card1.x, card1.y, { steps: 2 })
  await sleep(900)

  const probe = await page.$$eval('.emp-card', (ns) => {
    const first = ns[0]
    const top = Array.from(first.querySelectorAll('.emp-events--top .emp-event'))
    const bottom = Array.from(first.querySelectorAll('.emp-events--bottom .emp-event'))
    const read = (el) => ({
      name: el.querySelector('.emp-event-name')?.textContent,
      dim: el.getAttribute('data-dimension'),
      size: parseFloat(getComputedStyle(el.querySelector('.emp-event-name')).fontSize),
    })
    return {
      cardTransform: getComputedStyle(first).transform,
      nameSize: parseFloat(getComputedStyle(first.querySelector('.emp-name')).fontSize),
      reignSize: parseFloat(getComputedStyle(first.querySelector('.emp-reign')).fontSize),
      titleSize: parseFloat(getComputedStyle(first.querySelector('.emp-title')).fontSize),
      top: top.map(read),
      bottom: bottom.map(read),
      topLabel: first.querySelector('.emp-events--top .emp-group-label')?.textContent,
      bottomLabel: first.querySelector('.emp-events--bottom .emp-group-label')?.textContent,
      opacities: ns.map((n) => Number(getComputedStyle(n).opacity)),
    }
  })

  console.log(
    `\n[GROUP] 上(${probe.topLabel}): ${probe.top.map((e) => `${e.name}(${e.dim})`).join(' / ')}`,
  )
  console.log(`[GROUP] 下(${probe.bottomLabel}): ${probe.bottom.map((e) => `${e.name}(${e.dim})`).join(' / ')}`)
  console.log(
    `[TYPE ] 谥号=${probe.titleSize}px 姓名=${probe.nameSize}px 在位=${probe.reignSize}px 事件=${probe.top[0]?.size}px`,
  )

  check('上半区为军事成就', probe.top.length > 0 && probe.top.every((e) => e.dim === 'military'), probe.topLabel)
  check(
    '下半区为政治/文教',
    probe.bottom.length > 0 && probe.bottom.every((e) => e.dim !== 'military'),
    probe.bottomLabel,
  )
  check(
    '卡片自身无缩放（文字不发虚）',
    probe.cardTransform === 'none',
    probe.cardTransform,
  )
  check('姓名字号放大到 ≥14px', probe.nameSize >= 14, `${probe.nameSize}px`)
  check('在位时间字号 ≥11.5px', probe.reignSize >= 11.5, `${probe.reignSize}px`)
  check('事件名字号放大到 ≥13px', (probe.top[0]?.size ?? 0) >= 13, `${probe.top[0]?.size}px`)
  check(
    '其余模块变暗',
    probe.opacities.slice(1).every((o) => o < 0.5),
    probe.opacities.join(' / '),
  )

  await page.screenshot({ path: `${OUT}\\02-timeline-hover.png` })

  // 移开，浮层淡出
  await page.mouse.move(800, 60, { steps: 2 })
  await sleep(700)
  const collapsed = await page.$$eval('.emp-card .emp-event', (ns) =>
    ns.map((n) => Number(getComputedStyle(n).opacity)),
  )
  check('移开后浮层淡出', collapsed.every((o) => o < 0.2), `max=${Math.max(...collapsed)}`)

  /* ---------- 翻页：无黑场 ---------- */
  await page.mouse.move(800, 450)
  await page.mouse.wheel({ deltaY: 220 })
  await sleep(180) // 过渡进行中
  const duringTransition = await page.$$eval('.pager-track', (ns) => ns.length)
  check(
    '翻页过渡期间两页重叠（无黑场）',
    duringTransition >= 2,
    `同时挂载 ${duringTransition} 页`,
  )

  await sleep(900)
  const page2 = await titles()
  check('滚轮翻到下一页', page2[0] !== page1[0], `${page1[0]} → ${page2[0]}`)
  const countText2 = await page.$eval('.timeline-count', (n) => n.textContent?.trim())
  check('页码更新为第 2 页', /第 2 \/ 13 页/.test(countText2 ?? ''), countText2)

  /* ---------- 冷却：连滚不连翻 ---------- */
  const before = await page.$eval('.timeline-count', (n) => n.textContent?.trim())
  await page.mouse.wheel({ deltaY: 220 })
  await page.mouse.wheel({ deltaY: 220 })
  await page.mouse.wheel({ deltaY: 220 })
  await sleep(900)
  const after = await page.$eval('.timeline-count', (n) => n.textContent?.trim())
  const pageOf = (s) => Number(/第 (\d+) \//.exec(s ?? '')?.[1] ?? 0)
  check('冷却期内连滚只翻一页', pageOf(after) - pageOf(before) === 1, `${pageOf(before)} → ${pageOf(after)}`)

  /* ---------- 末页 ----------
     不能再用"一路滚到末页"：第 4 页（西周末页）下滚会进「平王东迁」过渡页。
     改用页码点直接跳末页，测的仍是末页版式。 */
  await page.evaluate(() => {
    const dots = document.querySelectorAll('.timeline-dot')
    dots[dots.length - 1]?.click()
  })
  await sleep(1200)
  const lastPage = await page.$$eval('.emp-card', (ns) => ns.length)
  const slots = await page.$$eval('.emp-slot', (ns) => ns.length)
  check('末页仅 1 位帝王 + 2 个空槽', lastPage === 1 && slots === 2, `cards=${lastPage} slots=${slots}`)
  check('末页为周赧王', (await titles()).join('') === '周赧王')
  await page.screenshot({ path: `${OUT}\\03-timeline-last.png` })

  /* ---------- ESC ---------- */
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

