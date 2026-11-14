/**
 * verify-fall.mjs —— 「周室倾覆 / 九鼎入秦」过渡页 + 谥法边框
 * ---------------------------------------------------------------------------
 * 要证明的事：
 *   1) 时间轴末页不再直接进沙盘，而是先进过渡页
 *   2) 过渡页三幕俱在、入口按时浮现、顶部有常驻出口
 *   3) 点入口 → 画卷展开 → 进入沙盘
 *   4) 帝王卡按谥法分色，且 hover 时边框提亮
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
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])

  /* ---------- 1) 帝王卡：谥法边框 ---------- */
  await page.goto(`${URL}/dynasty/zhou`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.emp-card')
  await page.evaluate(() => document.fonts.ready)
  await sleep(1200)

  const cards = await page.evaluate(() =>
    [...document.querySelectorAll('.emp-card')].map((c) => ({
      title: c.querySelector('.emp-title')?.textContent?.trim(),
      evaluation: c.getAttribute('data-evaluation'),
      border: getComputedStyle(c.querySelector('.emp-clip')).borderTopColor,
      rule: Boolean(c.querySelector('.emp-rule')),
    })),
  )
  console.log(`[CARDS] ${JSON.stringify(cards)}`)

  check('每张帝王卡都有谥法评价', cards.every((c) => ['good', 'neutral', 'bad'].includes(c.evaluation)))
  check('美谥为鎏金边', cards[0].border === 'rgba(201, 162, 39, 0.5)', cards[0].border)
  check('卡片含谥法本义小字', cards.every((c) => c.rule))

  const borderIdle = cards[0].border
  await page.hover('.emp-card')
  await sleep(500)
  const borderHover = await page.evaluate(
    () => getComputedStyle(document.querySelector('.emp-card .emp-clip')).borderTopColor,
  )
  check('悬浮时边框提亮', borderHover !== borderIdle, `${borderIdle} → ${borderHover}`)

  /* ---------- 2) 末页入口指向过渡页 ---------- */
  await page.$$eval('.timeline-dot', (ns) => ns[ns.length - 1].click())
  await sleep(900)
  const cta = await page.$eval('.timeline-btn--endgame', (n) => n.textContent?.trim()).catch(() => null)
  check('末页入口为「继续下滑 · 周室倾覆」', /周室倾覆/.test(cta ?? ''), cta)

  await page.click('.timeline-btn--endgame')
  await page.waitForSelector('.fall-page', { timeout: 8000 })
  check('进入过渡页', /\/fall$/.test(page.url()), page.url())

  /* ---------- 3) 过渡页内容 ---------- */
  const fall = await page.evaluate(() => ({
    title: document.querySelector('.fall-title')?.textContent?.trim(),
    subtitle: document.querySelector('.fall-subtitle')?.textContent?.trim(),
    acts: document.querySelectorAll('.fall-act').length,
    sources: document.querySelectorAll('.fall-source').length,
    back: document.querySelector('.fall-back')?.textContent?.trim(),
    ready: document.querySelector('.fall-page')?.getAttribute('data-ready'),
  }))
  console.log(`[FALL] ${JSON.stringify(fall)}`)

  check('标题为「九鼎入秦」', fall.title === '九鼎入秦', fall.title)
  check('副题为「周室倾覆」', fall.subtitle === '周室倾覆', fall.subtitle)
  check('三幕俱全', fall.acts === 3, `${fall.acts} 幕`)
  check('每幕附《史记》原文', fall.sources === 3, `${fall.sources} 段`)
  check('顶部有常驻返回出口', /返回时间轴/.test(fall.back ?? ''), fall.back)

  // 入场动画未走完时，入口应隐藏
  check('入场期间入口未出现', fall.ready === 'false', `ready=${fall.ready}`)

  /* ---------- 4) 点击跳过 → 入口浮现 ---------- */
  await page.click('.fall-page')
  await sleep(700)
  const readyAfterClick = await page.evaluate(() => ({
    ready: document.querySelector('.fall-page')?.getAttribute('data-ready'),
    btnOpacity: Number(getComputedStyle(document.querySelector('.fall-foot')).opacity),
    label: document.querySelector('.fall-enter-label')?.textContent?.trim(),
  }))
  console.log(`[ENTER] ${JSON.stringify(readyAfterClick)}`)
  check('点击后入口浮现', readyAfterClick.ready === 'true' && readyAfterClick.btnOpacity > 0.9)
  check('入口文字为「王朝覆灭」', readyAfterClick.label === '王朝覆灭', readyAfterClick.label)

  /* ---------- 5) 进入沙盘：画卷展开 ---------- */
  await page.click('.fall-enter')
  await sleep(260)
  const unfurl = await page.evaluate(() => ({
    el: Boolean(document.querySelector('.fall-unfurl')),
    animation: document.querySelector('.fall-unfurl')
      ? getComputedStyle(document.querySelector('.fall-unfurl')).animationName
      : null,
  }))
  check('点击后有画卷展开动效', unfurl.el && unfurl.animation === 'fall-unfurl', `${unfurl.animation}`)

  await page.waitForSelector('.map-stage', { timeout: 8000 })
  check('展开后进入沙盘', /\/endgame$/.test(page.url()), page.url())

  /* ---------- 6) 沙盘战前节点年份 ---------- */
  const railYear = await page.$eval('.rail-node--zero .rail-node-year', (n) => n.textContent?.trim())
  check('沙盘「战前」节点为前230', railYear === '前230', railYear)

  /* ---------- 7) 上滚返回时间轴 ---------- */
  await page.goto(`${URL}/dynasty/zhou/fall`, { waitUntil: 'networkidle2' })
  await sleep(800)
  await page.mouse.move(720, 300)
  await page.mouse.wheel({ deltaY: -240 })
  await sleep(1200)
  check('过渡页上滚返回时间轴', /\/dynasty\/zhou$/.test(page.url()), page.url())
  const backPage = await page
    .$eval('.timeline-count', (n) => n.textContent?.trim())
    .catch(() => null)
  check('返回后停在末页', /第 13 \/ 13 页/.test(backPage ?? ''), backPage)

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
