/**
 * verify-fall.mjs —— 「周室倾覆 / 九鼎入秦」三页过渡 + 谥法边框
 * ---------------------------------------------------------------------------
 * 要证明的事：
 *   1) 帝王卡按谥法分色，hover 提亮
 *   2) 时间轴末页不再直接进沙盘，先入过渡页
 *   3) 过渡页是三页翻页：文字逐字浮现；下滚跳过当前一幕，点击只跳过打字
 *   4) 【王朝覆灭】只在第三幕文字走完后出现；回滚即消失
 *   5) 每幕影像左右交替（鼎左 · 宗庙右 · 断符左）
 *   6) 第一页再上滚 → 弹确认框
 *   7) 点入口 → 画卷展开 → 沙盘（战前节点为前230）
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
      evaluation: c.getAttribute('data-evaluation'),
      border: getComputedStyle(c.querySelector('.emp-clip')).borderTopColor,
      rule: Boolean(c.querySelector('.emp-rule')),
    })),
  )
  check('每张帝王卡都有谥法评价', cards.every((c) => ['good', 'neutral', 'bad'].includes(c.evaluation)))
  check('美谥为鎏金边', cards[0].border === 'rgba(201, 162, 39, 0.92)', cards[0].border)
  check('卡片含谥法本义小字', cards.every((c) => c.rule))

  const borderIdle = cards[0].border
  await page.hover('.emp-card')
  await sleep(500)
  const borderHover = await page.evaluate(
    () => getComputedStyle(document.querySelector('.emp-card .emp-clip')).borderTopColor,
  )
  check('悬浮时边框提亮', borderHover !== borderIdle, `${borderIdle} → ${borderHover}`)

  /* ---------- 2) 末页入口 ---------- */
  await page.$$eval('.timeline-dot', (ns) => ns[ns.length - 1].click())
  await sleep(900)
  const cta = await page.$eval('.timeline-btn--endgame', (n) => n.textContent?.trim()).catch(() => null)
  check('末页入口为「继续下滑 · 周室倾覆」', /周室倾覆/.test(cta ?? ''), cta)

  await page.click('.timeline-btn--endgame')
  await page.waitForSelector('.fall-page', { timeout: 8000 })
  check('进入过渡页', /\/fall$/.test(page.url()), page.url())

  /* ---------- 3) 第一页：逐字浮现 ---------- */
  const typed = async () =>
    page.evaluate(() => {
      const lines = [...document.querySelectorAll('.fall-line')].map((n) => n.textContent ?? '')
      return lines.join('')
    })

  await sleep(420)
  const early = await typed()
  await sleep(4200)
  const full = await typed()
  console.log(`[TYPE] 早期 ${early.length} 字 / 完整 ${full.length} 字`)
  check('文字逐字浮现（先短后长）', early.length > 0 && early.length < full.length, `${early.length} < ${full.length}`)

  const p1 = await page.evaluate(() => ({
    page: document.querySelector('.fall-page')?.getAttribute('data-page'),
    heading: document.querySelector('.fall-heading')?.textContent?.trim(),
    art: (() => {
      const r = document.querySelector('.fall-art').getBoundingClientRect()
      return r.x + r.width / 2 < 720 ? 'left' : 'right'
    })(),
    btn: Number(getComputedStyle(document.querySelector('.fall-foot')).opacity),
  }))
  console.log(`[P1] ${JSON.stringify(p1)}`)
  check('第一幕为「秦取九鼎」', p1.heading === '秦取九鼎', p1.heading)
  check('第一幕影像在左', p1.art === 'left', p1.art)
  check('第一幕不出入口按钮', p1.btn < 0.05, `${p1.btn}`)

  /* ---------- 4) 下滚 = 跳过当前一幕 ---------- */
  await page.evaluate(() => {
    location.reload()
  })
  await page.waitForSelector('.fall-page', { timeout: 8000 })
  // 等过入场惯性保护（620ms）；此时第一幕仍在逐字
  await sleep(950)
  await page.mouse.move(700, 450)
  await page.mouse.wheel({ deltaY: 220 })
  await sleep(900)
  const skip1 = await page.evaluate(() => ({
    page: document.querySelector('.fall-page')?.getAttribute('data-page'),
    heading: document.querySelector('.fall-heading')?.textContent?.trim(),
    art: (() => {
      const r = document.querySelector('.fall-art').getBoundingClientRect()
      return r.x + r.width / 2 < 720 ? 'left' : 'right'
    })(),
  }))
  console.log(`[SKIP1] ${JSON.stringify(skip1)}`)
  check('文字未走完时下滚直接跳过第一幕', skip1.page === '1', `page=${skip1.page}`)
  check('跳过第一幕后落在第二幕', skip1.heading === '周既不祀', skip1.heading)
  check('第二幕影像在右', skip1.art === 'right', skip1.art)

  /* ---------- 5) 再滚一次跳过第二幕 ---------- */
  await page.mouse.wheel({ deltaY: 220 })
  await sleep(900)
  const p3 = await page.evaluate(() => ({
    page: document.querySelector('.fall-page')?.getAttribute('data-page'),
    heading: document.querySelector('.fall-heading')?.textContent?.trim(),
    art: (() => {
      const r = document.querySelector('.fall-art').getBoundingClientRect()
      return r.x + r.width / 2 < 720 ? 'left' : 'right'
    })(),
    btn: Number(getComputedStyle(document.querySelector('.fall-foot')).opacity),
  }))
  console.log(`[P3] ${JSON.stringify(p3)}`)
  check('再滚一次跳过第二幕，落到第三幕', p3.page === '2', `page=${p3.page}`)
  check('第三幕标题为权力更迭', /权力更迭/.test(p3.heading ?? ''), p3.heading)
  check('第三幕影像回到左侧', p3.art === 'left', p3.art)
  check('第三幕文字未走完时入口不出现', p3.btn < 0.05, `${p3.btn}`)

  // 点击 = 立刻显示完，并浮出入口
  await page.mouse.click(700, 450)
  await sleep(500)
  const btnAfterClick = await page.evaluate(() =>
    Number(getComputedStyle(document.querySelector('.fall-foot')).opacity),
  )
  check('点击可立刻显示完本页并出现入口', btnAfterClick > 0.9, `${btnAfterClick}`)

  /* ---------- 6) 上滚：入口消失 → 确认框 ---------- */
  await page.mouse.wheel({ deltaY: -220 })
  await sleep(900)
  const back2 = await page.evaluate(() => ({
    page: document.querySelector('.fall-page')?.getAttribute('data-page'),
    btn: Number(getComputedStyle(document.querySelector('.fall-foot')).opacity),
  }))
  console.log(`[BACK2] ${JSON.stringify(back2)}`)
  check('回滚到第二幕时入口消失', back2.page === '1' && back2.btn < 0.05, `page=${back2.page} btn=${back2.btn}`)

  await page.mouse.wheel({ deltaY: -220 })
  await sleep(900)
  await page.mouse.wheel({ deltaY: -220 })
  await sleep(700)
  const confirm = await page.evaluate(() => ({
    open: Boolean(document.querySelector('.fall-confirm')),
    title: document.querySelector('.fall-confirm-title')?.textContent?.trim(),
  }))
  console.log(`[CONFIRM] ${JSON.stringify(confirm)}`)
  check('第一页上滚弹出返回确认', confirm.open && /返回.*时间轴/.test(confirm.title ?? ''), confirm.title)

  // 取消 → 留在原地
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.fall-confirm-actions button')]
    btns[btns.length - 1].click()
  })
  await sleep(500)
  const stayed = await page.evaluate(() => ({
    confirm: Boolean(document.querySelector('.fall-confirm')),
    page: document.querySelector('.fall-page')?.getAttribute('data-page'),
  }))
  check('取消后留在过渡页', !stayed.confirm && stayed.page === '0', JSON.stringify(stayed))

  /* ---------- 7) 三页走完 → 进沙盘 ---------- */
  // 每次下滚跳过一幕：第一幕 → 第二幕 → 第三幕；再点一下结束第三幕逐字
  await page.mouse.wheel({ deltaY: 220 })
  await sleep(800)
  await page.mouse.wheel({ deltaY: 220 })
  await sleep(800)
  await page.mouse.click(700, 450)
  await sleep(600)

  const third = await page.evaluate(() => document.querySelector('.fall-page')?.getAttribute('data-page'))
  check('可连翻到第三页', third === '2', `page=${third}`)

  await page.click('.fall-enter')
  await sleep(260)
  const unfurl = await page.evaluate(() => Boolean(document.querySelector('.fall-unfurl')))
  check('点击后有画卷展开动效', unfurl)

  await page.waitForSelector('.map-stage', { timeout: 8000 })
  check('展开后进入沙盘', /\/endgame$/.test(page.url()), page.url())

  const railYear = await page.$eval('.rail-node--zero .rail-node-year', (n) => n.textContent?.trim())
  check('沙盘「战前」节点为前230', railYear === '前230', railYear)

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

