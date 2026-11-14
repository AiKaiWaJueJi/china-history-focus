/**
 * verify-qin.mjs —— 秦朝：模板复用验收
 * ---------------------------------------------------------------------------
 * 秦是"周模板"的第一个复刻对象，要证明：
 *   1) 史料时间轴能渲染秦的三位统治者，谥法栏统一标注"秦废谥法"
 *   2) 分段轴只有"秦朝"一段，并带沙丘/大泽乡两个标志点
 *   3) 没有诸侯数据时降级为单层布局（不出现诸侯行）
 *   4) 末页出现"继续下滑 · 秦亡"，一页到底（3 位 = 1 页）
 *   5) 进入过渡页 /fall，三幕逐字浮现、影像左右交替
 *   6) 第三幕走完浮出「汉兴 · 楚汉相争」，点击回朝代主页
 *   7) 上滚确认框、返回落回时间轴
 */
import puppeteer from 'puppeteer-core'

const BASE = process.env.APP_URL ?? 'http://localhost:5180'
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

  await page.goto(`${BASE}/dynasty/qin`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.emp-card')
  await sleep(800)

  /* ---------- 1) 帝王卡 ---------- */
  const cards = await page.evaluate(() =>
    [...document.querySelectorAll('.emp-card')].map((c) => ({
      title: c.querySelector('.emp-title')?.textContent?.trim(),
      name: c.querySelector('.emp-name')?.textContent?.trim(),
      rule: c.querySelector('.emp-rule')?.textContent?.trim(),
      evaluation: c.getAttribute('data-evaluation'),
      events: c.querySelectorAll('.emp-event').length,
    })),
  )
  console.log(`[CARDS] ${JSON.stringify(cards)}`)
  check('三位统治者齐备', cards.length === 3, String(cards.length))
  check('第一位是秦始皇', cards[0]?.title === '秦始皇' && cards[0]?.name === '嬴政', `${cards[0]?.title}/${cards[0]?.name}`)
  check('谥法栏标注「秦废谥法」', (cards[0]?.rule ?? '').includes('秦废谥法'), cards[0]?.rule)
  check('评价统一为 neutral', cards.every((c) => c.evaluation === 'neutral'))
  check('每张卡都有事件节点', cards.every((c) => c.events > 0), cards.map((c) => c.events).join('/'))

  /* ---------- 2) 分段轴 ---------- */
  const axis = await page.evaluate(() => ({
    bands: [...document.querySelectorAll('.seg-band')].map((b) => b.textContent?.replace(/\s+/g, ' ').trim()),
    markers: [...document.querySelectorAll('.seg-marker')].map((m) => m.textContent?.replace(/\s+/g, ' ').trim()),
  }))
  console.log(`[AXIS] ${JSON.stringify(axis)}`)
  check('分段轴只有「秦朝」一段', axis.bands.length === 1 && (axis.bands[0] ?? '').includes('秦朝'), axis.bands.join('|'))
  check('有沙丘与大泽乡两个标志点', axis.markers.length === 2 && axis.markers.join('').includes('沙丘'), axis.markers.join('|'))

  /* ---------- 3) 单层布局（无诸侯） ---------- */
  const layout = await page.evaluate(() => ({
    stage: document.querySelector('.timeline-stage')?.getAttribute('data-layout'),
    lords: document.querySelectorAll('.lord-card').length,
    count: document.querySelector('.timeline-count')?.textContent?.trim(),
  }))
  console.log(`[LAYOUT] ${JSON.stringify(layout)}`)
  check('无诸侯时降级为单层', layout.stage === 'single' && layout.lords === 0, `${layout.stage}/${layout.lords}`)
  check('秦只有 1 页', /第 1 \/ 1 页/.test(layout.count ?? ''), layout.count)

  /* ---------- 4) 末页入口 ---------- */
  const cta = await page.$eval('.timeline-btn--endgame', (n) => n.textContent?.trim()).catch(() => null)
  check('末页入口为「继续下滑 · 秦亡」', /秦亡/.test(cta ?? ''), cta)

  await page.click('.timeline-btn--endgame')
  await page.waitForSelector('.fall-page', { timeout: 8000 })
  check('进入过渡页 /fall', /\/dynasty\/qin\/fall$/.test(page.url()), page.url())

  /* ---------- 5) 三幕 ---------- */
  const typed = () =>
    page.evaluate(() => [...document.querySelectorAll('.fall-line')].map((n) => n.textContent ?? '').join(''))
  await sleep(430)
  const early = await typed()
  await sleep(4200)
  const full = await typed()
  check('文字逐字浮现', early.length > 0 && early.length < full.length, `${early.length} < ${full.length}`)

  const p1 = await page.evaluate(() => ({
    title: document.querySelector('.fall-brand-title')?.textContent?.trim(),
    sub: document.querySelector('.fall-brand-sub')?.textContent?.trim(),
    heading: document.querySelector('.fall-heading')?.textContent?.trim(),
    art: (() => {
      const r = document.querySelector('.fall-art')?.getBoundingClientRect()
      return r ? (r.x + r.width / 2 < 720 ? 'left' : 'right') : null
    })(),
  }))
  console.log(`[P1] ${JSON.stringify(p1)}`)
  check('章标题为「二世而亡」', p1.title === '二世而亡', p1.title)
  check('副题为「秦亡」', p1.sub === '秦亡', p1.sub)
  check('第一幕为「沙丘之变」', p1.heading === '沙丘之变', p1.heading)
  check('第一幕影像在左', p1.art === 'left', String(p1.art))

  await page.mouse.move(700, 500)
  await page.mouse.wheel({ deltaY: 220 })
  await sleep(1100)
  const p2 = await page.evaluate(() => ({
    heading: document.querySelector('.fall-heading')?.textContent?.trim(),
    art: (() => {
      const r = document.querySelector('.fall-art')?.getBoundingClientRect()
      return r ? (r.x + r.width / 2 < 720 ? 'left' : 'right') : null
    })(),
  }))
  check('第二幕为「大泽乡」且影像在右', p2.heading === '大泽乡' && p2.art === 'right', `${p2.heading}/${p2.art}`)

  await page.mouse.click(700, 500)
  await sleep(250)
  await page.mouse.wheel({ deltaY: 220 })
  await sleep(1100)
  const p3 = await page.evaluate(() => ({
    heading: document.querySelector('.fall-heading')?.textContent?.trim(),
    btn: Number(getComputedStyle(document.querySelector('.fall-foot')).opacity),
  }))
  check('第三幕为「素车白马」', p3.heading === '素车白马', p3.heading)
  check('第三幕文字未走完时入口不出现', p3.btn < 0.05, String(p3.btn))

  await sleep(5200)
  const entrance = await page.evaluate(() => ({
    btn: Number(getComputedStyle(document.querySelector('.fall-foot')).opacity),
    label: document.querySelector('.fall-enter-label')?.textContent?.trim(),
  }))
  check('文字走完后入口出现', entrance.btn > 0.9, String(entrance.btn))
  check('入口文案为「汉兴 · 楚汉相争」', /汉兴/.test(entrance.label ?? ''), entrance.label)

  /* ---------- 6) 点入口回主页 ---------- */
  await page.click('.fall-enter')
  await sleep(1400)
  await page.waitForSelector('.gallery-stage, .app-main', { timeout: 8000 })
  check('点击后回到朝代主页', new globalThis.URL(page.url()).pathname === '/', page.url())

  /* ---------- 7) 上滚确认 + 返回 ---------- */
  await page.goto(`${BASE}/dynasty/qin/fall`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('.fall-page')
  await sleep(700)
  await page.mouse.move(700, 500)
  await page.mouse.wheel({ deltaY: -220 })
  await sleep(700)
  const confirm = await page.evaluate(() => ({
    open: Boolean(document.querySelector('.fall-confirm')),
    title: document.querySelector('.fall-confirm-title')?.textContent?.trim(),
  }))
  check('上滚弹出返回确认', confirm.open && /返回.*时间轴/.test(confirm.title ?? ''), confirm.title)

  await page.click('.fall-confirm-primary')
  await sleep(1400)
  await page.waitForSelector('.timeline-count', { timeout: 8000 })
  check('确认后回到秦的时间轴', /\/dynasty\/qin$/.test(page.url()), page.url())

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
