/**
 * verify-endgame.mjs —— 终局推演验收
 * ---------------------------------------------------------------------------
 * 覆盖：
 *   1. 时间轴末页出现「推演终局」入口；在末页继续向下滚也能进入
 *   2. idle：6 个诸侯容器、版图 0/6、开始按钮
 *   3. playing：逐国灰化（1→6）、战报逐条浮现、版图逐格淬金
 *   4. sealed：秦印出现、入口卡片变为【大秦帝国 · 公元前221年】
 *   5. 点击入口 → 跳转 /dynasty/qin，并渲染秦朝帝王（秦始皇）
 *   6. 全程无控制台错误
 */
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const URL = process.env.APP_URL ?? 'http://localhost:5180'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = 'D:\\文档\\deepseek-harness\\default-workspace\\china-history-focus\\shots\\v6'
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
  args: ['--no-sandbox', '--force-device-scale-factor=1', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 1600, height: 900 },
})

try {
  const page = await browser.newPage()
  await page.setCacheEnabled(false)
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(String(e)))

  /* ---------- 1) 从时间轴末页进入 ---------- */
  await page.goto(`${URL}/dynasty/zhou`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.emp-card')
  await page.evaluate(() => document.fonts.ready)
  await sleep(2400)

  await page.$$eval('.timeline-dot', (ns) => ns[ns.length - 1].click())
  await sleep(1000)
  const lastPage = await page.$eval('.timeline-count', (n) => n.textContent?.trim())
  check('到达时间轴末页（第 13 页）', /第 13 \/ 13 页/.test(lastPage ?? ''), lastPage)

  const endgameBtn = await page.$('.timeline-btn--endgame')
  const endgameBtnText = await page
    .$eval('.timeline-btn--endgame', (n) => n.textContent?.trim())
    .catch(() => null)
  check('末页出现「推演终局」入口', Boolean(endgameBtn), endgameBtnText ?? '未找到')

  await page.click('.timeline-btn--endgame')
  await sleep(900)
  check('点击入口跳转到终局页', /\/dynasty\/zhou\/endgame$/.test(page.url()), page.url())
  await page.waitForSelector('.endgame-page', { timeout: 10000 })

  /* ---------- 2) idle 态 ---------- */
  await sleep(600)
  const idle = await page.evaluate(() => ({
    phase: document.querySelector('.endgame-page')?.getAttribute('data-phase'),
    tiles: document.querySelectorAll('.state-tile').length,
    fallen: document.querySelectorAll('.state-tile.is-fallen').length,
    inked: document.querySelectorAll('.hex.is-inked').length,
    hasStart: Boolean(document.querySelector('.start-btn')),
    intro: document.querySelector('.battle-log-intro')?.textContent?.slice(0, 12),
  }))
  console.log(`\n[IDLE] ${JSON.stringify(idle)}`)
  check('idle 阶段', idle.phase === 'idle', idle.phase)
  check('渲染 6 个诸侯容器', idle.tiles === 6, `${idle.tiles}`)
  check('初始无国家陷落', idle.fallen === 0 && idle.inked === 0, `${idle.fallen}/${idle.inked}`)
  check('显示「开启统一进程」按钮', idle.hasStart)
  check('左侧显示序章文字', Boolean(idle.intro))
  await page.screenshot({ path: `${OUT}\\01-idle.png` })

  /* ---------- 3) 推演中：逐步灰化 ---------- */
  // 在点击前装一个采样器，记录每次"陷落数量"跳变的时刻，用于核对节奏
  await page.evaluate(() => {
    window.__rhythm = []
    const t0 = performance.now()
    window.__rhythmTimer = setInterval(() => {
      window.__rhythm.push([
        Math.round(performance.now() - t0),
        document.querySelectorAll('.state-tile.is-fallen').length,
      ])
    }, 40)
  })

  await page.click('.start-btn')
  /*
    新节奏：首国 0.48s 落下、第二国 1.78s，灰化过渡 720ms。
    取 1.15s 采样 —— 第 1 国已基本灰透，第 2 国尚未开始。
  */
  await sleep(1150)
  const step1 = await page.evaluate(() => ({
    phase: document.querySelector('.endgame-page')?.getAttribute('data-phase'),
    fallen: document.querySelectorAll('.state-tile.is-fallen').length,
    inked: document.querySelectorAll('.hex.is-inked').length,
    reports: document.querySelectorAll('.battle-log-item').length,
    // 灰化作用在内层 .state-tile-face 上（印章留在外层保持血红），所以取 face 的 filter
    firstTileFilter: getComputedStyle(document.querySelectorAll('.state-tile-face')[0]).filter,
    secondTileFilter: getComputedStyle(document.querySelectorAll('.state-tile-face')[1]).filter,
  }))
  console.log(`[STEP 1] ${JSON.stringify(step1)}`)
  check('进入推演阶段', step1.phase === 'playing', step1.phase)
  check('第 1 国已灰化', step1.fallen === 1, `${step1.fallen}`)
  check('版图已淬金 1 格', step1.inked === 1, `${step1.inked}`)
  check('战报出现 1 条', step1.reports === 1, `${step1.reports}`)
  // grayscale 是 720ms 的过渡，取样时可能落在 0.9~1 之间，因此按数值判定
  const greyLevel = (filter) => {
    const m = /grayscale\(([\d.]+)\)/.exec(filter ?? '')
    return m ? Number(m[1]) : 0
  }
  check(
    '已亡国灰化（grayscale ≥ 0.9），未亡国保持彩色',
    greyLevel(step1.firstTileFilter) >= 0.9 && greyLevel(step1.secondTileFilter) < 0.1,
    `第一块=${greyLevel(step1.firstTileFilter)}，第二块=${greyLevel(step1.secondTileFilter)}`,
  )
  await page.screenshot({ path: `${OUT}\\02-playing.png` })

  await sleep(1600) // 累计约 2.75s → 应有 2 国倒下（第 3 国 3.42s 才落）
  const stepLater = await page.evaluate(() => ({
    fallen: document.querySelectorAll('.state-tile.is-fallen').length,
    reports: document.querySelectorAll('.battle-log-item').length,
  }))
  console.log(`[STEP N] ${JSON.stringify(stepLater)}`)
  check('序列按序推进（后续步骤继续增加）', stepLater.fallen >= 2, `${stepLater.fallen} 国`)
  check('战报与陷落数量同步', stepLater.reports === stepLater.fallen, `${stepLater.reports}/${stepLater.fallen}`)

  /* ---------- 4) sealed：秦印 + 入口 ---------- */
  await page.waitForFunction(
    () => document.querySelector('.endgame-page')?.getAttribute('data-phase') === 'sealed',
    { timeout: 15000 },
  )
  await sleep(500)
  const sealed = await page.evaluate(() => ({
    fallen: document.querySelectorAll('.state-tile.is-fallen').length,
    inked: document.querySelectorAll('.hex.is-inked').length,
    reports: document.querySelectorAll('.battle-log-item').length,
    hasSeal: Boolean(document.querySelector('.qin-seal-char')),
    entryText: document.querySelector('.qin-entry')?.textContent?.replace(/\s+/g, ' ').trim(),
    countText: document.querySelector('.territory-count')?.textContent?.replace(/\s+/g, ' ').trim(),
  }))
  console.log(`[SEALED] ${JSON.stringify(sealed)}`)
  check('六国全部陷落', sealed.fallen === 6, `${sealed.fallen}`)
  check('版图六格全部淬金', sealed.inked === 6, `${sealed.inked}`)
  check('战报累计 6 条', sealed.reports === 6, `${sealed.reports}`)
  check('秦印出现', sealed.hasSeal)
  check('版图计数为 6/6', /6\s*\/\s*6/.test(sealed.countText ?? ''), sealed.countText)
  check(
    '出现【大秦帝国 · 公元前221年】入口',
    /大秦帝国/.test(sealed.entryText ?? '') && /公元前221年/.test(sealed.entryText ?? ''),
    sealed.entryText,
  )
  await page.screenshot({ path: `${OUT}\\03-seal-impact.png` })

  // 印章落定后，入口卡片必须真正浮现（有入场延迟，要等它走完）
  await sleep(2000)
  const entryState = await page.$eval('.qin-entry', (n) => {
    const s = getComputedStyle(n)
    const r = n.getBoundingClientRect()
    return { opacity: Number(s.opacity), w: Math.round(r.width), h: Math.round(r.height) }
  })
  console.log(`[ENTRY] opacity=${entryState.opacity} ${entryState.w}×${entryState.h}`)
  check('入口卡片最终完全可见（opacity ≥ 0.95）', entryState.opacity >= 0.95, `${entryState.opacity}`)
  check('入口卡片可点击（尺寸正常）', entryState.w > 200 && entryState.h > 80, `${entryState.w}×${entryState.h}`)

  // 秦印淡为水印，不再遮挡
  const sealOpacity = await page.$eval('.qin-seal', (n) => Number(getComputedStyle(n).opacity))
  check('秦印淡为水印（不再遮挡）', sealOpacity <= 0.2, `${sealOpacity}`)
  await page.screenshot({ path: `${OUT}\\03b-sealed.png` })

  /* ---------- 5) 节奏：按真实亡国年差排布（必须在离开本页前读取采样） ---------- */
  await page.evaluate(() => clearInterval(window.__rhythmTimer))
  const rhythm = await page.evaluate(() => window.__rhythm)

  // 找出每个数量首次出现的时刻（offset 无关，只看间隔）
  const timeline = []
  let seen = 0
  for (const [t, count] of rhythm) {
    if (count > seen) {
      seen = count
      timeline.push(t)
    }
  }
  const gaps = timeline.slice(1).map((t, i) => t - timeline[i])
  // 史实年差：赵2年→1300ms、魏3年→1640ms、楚2年→1300ms、燕1年→960ms、齐1年→960ms
  const expected = [1300, 1640, 1300, 960, 960]
  console.log(`\n[RHYTHM] 实测间隔: ${gaps.join(', ')} ms`)
  console.log(`[RHYTHM] 期望间隔: ${expected.join(', ')} ms`)

  check('六国依次陷落（采样到 6 次跳变）', timeline.length === 6, `${timeline.length} 次`)
  check(
    '间隔按真实年差排布（误差 ≤300ms）',
    gaps.length === expected.length &&
      gaps.every((gap, i) => Math.abs(gap - expected[i]) <= 300),
    gaps.map((g, i) => `${g}/${expected[i]}`).join(' '),
  )
  check(
    '呈现"前缓后急"加速（首个间隔 > 末个间隔）',
    gaps.length >= 2 && gaps[0] > gaps[gaps.length - 1],
    `${gaps[0]} → ${gaps[gaps.length - 1]}`,
  )


  /* ---------- 6) 进入秦朝 ---------- */
  await page.click('.qin-entry')
  await sleep(1400)
  check('点击入口跳转到秦朝时间轴', /\/dynasty\/qin$/.test(page.url()), page.url())
  const qinTitles = await page.$$eval('.emp-title', (ns) => ns.map((n) => n.textContent?.trim()))
  const qinCount = await page.$eval('.timeline-count', (n) => n.textContent?.trim())
  console.log(`[QIN] ${qinCount} · ${qinTitles.join(' / ')}`)
  check('秦朝帝王页渲染成功', qinTitles.length === 3 && qinTitles[0] === '秦始皇', qinTitles.join('/'))
  check('秦朝共 3 位帝王', /共 3 位帝王/.test(qinCount ?? ''), qinCount)
  await page.screenshot({ path: `${OUT}\\04-qin-timeline.png` })

  /* ---------- 7) 末页继续下滚也能进入终局 ---------- */
  await page.goto(`${URL}/dynasty/zhou`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('.emp-card')
  await sleep(2200)
  await page.$$eval('.timeline-dot', (ns) => ns[ns.length - 1].click())
  await sleep(900)
  await page.mouse.move(800, 450)
  await page.mouse.wheel({ deltaY: 240 })
  await sleep(1200)
  check('末页继续下滚进入终局', /\/endgame$/.test(page.url()), page.url())

  check('无控制台错误', errors.length === 0, errors.slice(0, 2).join(' | '))
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
