/**
 * verify-codex-ui.mjs —— 历史档案抽屉（无限下钻）的交互验收
 * ===========================================================================
 * 验六件事：
 *   1. 从战报标题打开档案：抽屉从右侧出现，且**只有一个**抽屉（不是弹窗叠弹窗）；
 *   2. 正文词条下钻：面包屑变两层、返回可用、内容换成下一层；
 *   3. 面包屑跳级：点第一级回到根；
 *   4. ESC 关闭，且**不会**把页面退回上一级（捕获阶段拦下）；
 *   5. 背景只压暗（.app-shell opacity ≈ 0.5），没有全屏黑底遮罩；
 *   6. 帝王卡的「档」按钮、战报里的人名都能开档案；旧的 FigureModal 已不再出现。
 */
import puppeteer from 'puppeteer-core'

const BASE = process.env.APP_URL ?? 'http://localhost:5180'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--no-sandbox', '--force-device-scale-factor=1'],
  defaultViewport: { width: 1440, height: 900 },
})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' :: ' + detail : ''}`)
}

const drawerState = (page) =>
  page.evaluate(() => {
    const drawer = document.querySelector('.codex-drawer')
    const veil = document.querySelector('.codex-veil')
    const shell = document.querySelector('.app-shell')
    const name = drawer?.querySelector('.codex-name')?.textContent?.trim() ?? ''
    const kind = drawer?.querySelector('.codex-kind')?.textContent?.trim() ?? ''
    const crumbs = [...(drawer?.querySelectorAll('.codex-crumb') ?? [])].map((n) => n.textContent?.trim())
    const back = drawer?.querySelector('.codex-back')
    const quote = drawer?.querySelector('.codex-quote-text')
    const quoteStyle = quote ? getComputedStyle(quote).fontFamily : ''
    const trans = drawer?.querySelector('.codex-quote-translation')?.textContent?.trim() ?? ''
    const chips = [...(drawer?.querySelectorAll('.codex-chip') ?? [])].map((n) =>
      n.textContent?.replace(/\s+/g, '').trim(),
    )
    return {
      count: document.querySelectorAll('.codex-drawer').length,
      name,
      kind,
      crumbs,
      backDisabled: back ? back.disabled : null,
      quoteFont: quoteStyle,
      hasTranslation: trans.length > 10,
      chips,
      shellOpacity: shell ? Number(getComputedStyle(shell).opacity) : 1,
      veilBg: veil ? getComputedStyle(veil).backgroundColor : '',
      figureModal: Boolean(document.querySelector('.figure-modal')),
      url: location.pathname,
    }
  })

try {
  const page = await browser.newPage()
  await page.setCacheEnabled(false)
  page.on('pageerror', (e) => console.log('[PAGEERROR]', String(e).slice(0, 160)))

  /* ---------- 1. 战报标题 → 史料抽屉 ---------- */
  await page.goto(`${BASE}/dynasty/zhou/endgame`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.map-svg', { timeout: 15000 })
  await sleep(1200)

  await page.evaluate(() => {
    document.querySelector('[data-nation="han"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await page.waitForSelector('.battle-codex', { timeout: 15000 })
  await sleep(2600)
  await page.click('.battle-codex')
  await sleep(700)

  const d1 = await drawerState(page)
  console.log('[D1]', JSON.stringify(d1))
  check('战报「史料」能打开抽屉', d1.count === 1, `抽屉数=${d1.count}`)
  check('抽屉标题为该战', d1.name === '秦灭韩', d1.name)
  check('类型徽章为「战役」', d1.kind === '战役', d1.kind)
  check('有楷体原文块', /KaiTi|楷体|STKaiti/.test(d1.quoteFont), d1.quoteFont)
  check('有白话译文', d1.hasTranslation)
  check('背景压暗到 0.5 左右', d1.shellOpacity <= 0.55 && d1.shellOpacity > 0.3, String(d1.shellOpacity))
  check('没有全屏黑底（veil 透明度 < 0.4）', /0\.26/.test(d1.veilBg), d1.veilBg)
  check('旧的 FigureModal 不再出现', !d1.figureModal)

  /* ---------- 2. 下钻 ---------- */
  await page.evaluate(() => {
    const link = [...document.querySelectorAll('.codex-drawer .codex-link')].find((n) =>
      n.textContent?.includes('内史腾'),
    )
    link?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await sleep(700)
  const d2 = await drawerState(page)
  console.log('[D2]', JSON.stringify(d2))
  check('下钻后仍只有一个抽屉（不叠新弹窗）', d2.count === 1, `抽屉数=${d2.count}`)
  check('下钻后标题换成人物', d2.name === '内史腾', d2.name)
  check('面包屑变两层', d2.crumbs.join('›') === '秦灭韩›内史腾', d2.crumbs.join('›'))
  check('返回按钮已可用', d2.backDisabled === false, String(d2.backDisabled))
  check('人物条目有关联列表', d2.chips.length > 0, d2.chips.join(' | '))

  /* ---------- 3. 面包屑跳级 ---------- */
  await page.evaluate(() => {
    const crumb = [...document.querySelectorAll('.codex-drawer .codex-crumb')].find(
      (n) => n.textContent?.trim() === '秦灭韩',
    )
    crumb?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await sleep(700)
  const d3 = await drawerState(page)
  check('面包屑点一级回到根', d3.crumbs.length === 1 && d3.name === '秦灭韩', d3.crumbs.join('›'))
  check('回到根后返回按钮置灰', d3.backDisabled === true, String(d3.backDisabled))

  /* ---------- 4. ESC ---------- */
  const beforeEsc = await page.evaluate(() => location.pathname)
  await page.keyboard.press('Escape')
  await sleep(500)
  const afterEsc = await page.evaluate(() => ({
    drawer: Boolean(document.querySelector('.codex-drawer')),
    url: location.pathname,
  }))
  check('ESC 关闭抽屉', !afterEsc.drawer)
  check('ESC 不会把页面也退掉', afterEsc.url === beforeEsc, `${beforeEsc} → ${afterEsc.url}`)

  /* ---------- 5. 战报人名 ---------- */
  await page.evaluate(() => {
    const tag = document.querySelector('.figure-tag')
    tag?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await sleep(600)
  const d5 = await drawerState(page)
  check('战报人名能开档案', d5.count === 1 && d5.kind === '人物', `${d5.kind}/${d5.name}`)
  check('人名路径下没有旧浮层', !d5.figureModal)
  await page.keyboard.press('Escape')
  await sleep(400)

  /* ---------- 6. 帝王卡「档」按钮 ---------- */
  await page.goto(`${BASE}/dynasty/zhou`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.emp-card', { timeout: 15000 })
  await sleep(900)
  const btnCount = await page.evaluate(() => document.querySelectorAll('.emp-codex').length)
  check('帝王卡上有「档」按钮', btnCount > 0, `${btnCount} 个`)
  await page.evaluate(() => {
    document.querySelector('.emp-codex')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await sleep(700)
  const d6 = await drawerState(page)
  check('帝王卡能开档案', d6.count === 1 && d6.kind === '帝王', `${d6.kind}/${d6.name}`)
  check('帝王档案有正文', d6.name.length > 0 && d6.crumbs.length === 1)

  const passed = results.filter((r) => r.pass).length
  console.log(`\n===== ${passed}/${results.length} passed =====`)
  if (passed !== results.length) process.exitCode = 1
} finally {
  await browser.close()
}
