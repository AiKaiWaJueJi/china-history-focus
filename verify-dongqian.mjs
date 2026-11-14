/**
 * verify-dongqian.mjs —— 西周 → 东周 的段间过渡页（平王东迁）
 * ---------------------------------------------------------------------------
 * 要证明的事：
 *   1) 时间轴第 3 页（西周最后一页）页脚出现「继续下滑 · 平王东迁」
 *   2) 在该页继续下滚 → 进入 /fall/dongqian，而不是翻到东周
 *   3) 过渡页结构与「周室倾覆」一致：三幕、逐字浮现、影像左右交替
 *   4) 第三幕文字走完才浮出入口；入口文案为「东周 · 礼崩乐坏」
 *   5) 点击入口 → 回到时间轴第 4 页（东周首页 = 平王）
 *   6) 第一幕上滚 → 弹确认框；确认后回到第 3 页
 *   7) 老路由 /fall 仍是「周室倾覆」，未受影响
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
  defaultViewport: { width: 1440, height: 900 },
})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

try {
  const page = await browser.newPage()
  await page.setCacheEnabled(false)
  page.on('pageerror', (e) => console.log('[PAGEERROR]', String(e).slice(0, 160)))

  /* ---------- 1) 西周末页的页脚入口 ---------- */
  await page.goto(`${URL}/dynasty/zhou`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.timeline-dot')
  const dots = await page.$$('.timeline-dot')
  await dots[3].click() // 第 4 个点 = 页索引 3 = 西周最后一页
  await sleep(700)

  const gate = await page.evaluate(() => ({
    label: document.querySelector('.timeline-btn--endgame')?.textContent?.trim(),
    page: document.querySelector('.timeline-count')?.textContent?.trim(),
    firstCard: document.querySelector('.emp-card')?.textContent?.slice(0, 20),
  }))
  console.log(`[GATE] ${JSON.stringify(gate)}`)
  check('西周末页出现「平王东迁」入口', /平王东迁/.test(gate.label ?? ''), gate.label)

  /* ---------- 2) 下滚 → 过渡页 ---------- */
  await page.mouse.move(700, 500)
  await sleep(900) // 越过 800ms 防抖
  await page.mouse.wheel({ deltaY: 220 })
  await page.waitForSelector('.fall-page', { timeout: 8000 })
  check('下滚进入 /fall/dongqian', /\/fall\/dongqian$/.test(page.url()), page.url())

  /* ---------- 3) 第一幕 ---------- */
  const typed = () =>
    page.evaluate(() => [...document.querySelectorAll('.fall-line')].map((n) => n.textContent ?? '').join(''))
  await sleep(450)
  const early = await typed()
  await sleep(4200)
  const full = await typed()
  check('文字逐字浮现', early.length > 0 && early.length < full.length, `${early.length} < ${full.length}`)

  const first = await page.evaluate(() => ({
    title: document.querySelector('.fall-brand-title')?.textContent?.trim(),
    sub: document.querySelector('.fall-brand-sub')?.textContent?.trim(),
    heading: document.querySelector('.fall-heading')?.textContent?.trim(),
    art: (() => {
      const r = document.querySelector('.fall-art')?.getBoundingClientRect()
      return r ? (r.x + r.width / 2 < 720 ? 'left' : 'right') : null
    })(),
    btn: Number(getComputedStyle(document.querySelector('.fall-foot')).opacity),
  }))
  console.log(`[P1] ${JSON.stringify(first)}`)
  check('章标题为「平王东迁」', first.title === '平王东迁', first.title)
  check('副题为「西周之亡」', first.sub === '西周之亡', first.sub)
  check('第一幕为「犬戎破镐京」', first.heading === '犬戎破镐京', first.heading)
  check('第一幕影像在左', first.art === 'left', String(first.art))
  check('第一幕不出入口', first.btn < 0.05, String(first.btn))

  /* ---------- 4) 翻到第二、三幕 ---------- */
  await page.mouse.wheel({ deltaY: 220 })
  await sleep(1100)
  const second = await page.evaluate(() => ({
    heading: document.querySelector('.fall-heading')?.textContent?.trim(),
    art: (() => {
      const r = document.querySelector('.fall-art')?.getBoundingClientRect()
      return r ? (r.x + r.width / 2 < 720 ? 'left' : 'right') : null
    })(),
  }))
  console.log(`[P2] ${JSON.stringify(second)}`)
  check('第二幕为「平王东迁」', second.heading === '平王东迁', second.heading)
  check('第二幕影像在右', second.art === 'right', String(second.art))

  await page.mouse.click(700, 500) // 跳过打字
  await sleep(250)
  await page.mouse.wheel({ deltaY: 220 })
  await sleep(1100)
  const third = await page.evaluate(() => ({
    heading: document.querySelector('.fall-heading')?.textContent?.trim(),
    btn: Number(getComputedStyle(document.querySelector('.fall-foot')).opacity),
  }))
  console.log(`[P3] ${JSON.stringify(third)}`)
  check('第三幕为「王纲解纽」', third.heading === '王纲解纽', third.heading)
  check('第三幕文字未走完时入口不出现', third.btn < 0.05, String(third.btn))

  await sleep(5200)
  const entrance = await page.evaluate(() => ({
    btn: Number(getComputedStyle(document.querySelector('.fall-foot')).opacity),
    label: document.querySelector('.fall-enter-label')?.textContent?.trim(),
  }))
  check('文字走完后入口出现', entrance.btn > 0.9, String(entrance.btn))
  check('入口文案为「东周 · 礼崩乐坏」', /东周/.test(entrance.label ?? ''), entrance.label)

  /* ---------- 5) 点入口 → 东周首页 ---------- */
  await page.click('.fall-enter')
  await sleep(1400)
  await page.waitForSelector('.timeline-count', { timeout: 8000 })
  const landed = await page.evaluate(() => ({
    url: location.pathname,
    count: document.querySelector('.timeline-count')?.textContent?.trim(),
    firstCard: document.querySelector('.emp-card')?.textContent?.slice(0, 24),
  }))
  console.log(`[LANDED] ${JSON.stringify(landed)}`)
  check('回到时间轴', landed.url === '/dynasty/zhou', landed.url)
  check('落在东周首页（第 5 / 13 页）', /第 5 \/ 13 页/.test(landed.count ?? ''), landed.count)

  /* ---------- 6) 第一幕上滚 → 确认框 ---------- */
  await page.goto(`${URL}/dynasty/zhou/fall/dongqian`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('.fall-page')
  await sleep(700)
  await page.mouse.move(700, 500)
  await page.mouse.wheel({ deltaY: -220 })
  await sleep(700)
  const confirm = await page.evaluate(() => ({
    open: Boolean(document.querySelector('.fall-confirm')),
    title: document.querySelector('.fall-confirm-title')?.textContent?.trim(),
  }))
  console.log(`[CONFIRM] ${JSON.stringify(confirm)}`)
  check('第一幕上滚弹出返回确认', confirm.open && /返回.*时间轴/.test(confirm.title ?? ''), confirm.title)

  await page.click('.fall-confirm-primary')
  await sleep(1400)
  await page.waitForSelector('.timeline-count', { timeout: 8000 })
  const back = await page.evaluate(() => ({
    url: location.pathname,
    count: document.querySelector('.timeline-count')?.textContent?.trim(),
  }))
  console.log(`[BACK] ${JSON.stringify(back)}`)
  check('确认后回到西周末页（第 4 / 13 页）', /第 4 \/ 13 页/.test(back.count ?? ''), back.count)

  /* ---------- 7) 老路由不受影响 ---------- */
  await page.goto(`${URL}/dynasty/zhou/fall`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('.fall-page')
  await sleep(600)
  const legacy = await page.evaluate(() => ({
    title: document.querySelector('.fall-brand-title')?.textContent?.trim(),
    heading: document.querySelector('.fall-heading')?.textContent?.trim(),
  }))
  console.log(`[LEGACY] ${JSON.stringify(legacy)}`)
  check('/fall 仍是「九鼎入秦」', legacy.title === '九鼎入秦', legacy.title)
  check('/fall 第一幕仍是「秦取九鼎」', legacy.heading === '秦取九鼎', legacy.heading)

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
