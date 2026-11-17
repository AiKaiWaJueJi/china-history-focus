/**
 * verify-codex-ui.mjs —— 历史档案抽屉（无限下钻）的交互验收
 * ===========================================================================
 * 验七件事：
 *   1. 从战报标题打开档案：抽屉从右侧出现，且**只有一个**抽屉（不是弹窗叠弹窗）；
 *   2. 正文词条下钻：面包屑变两层、返回可用、内容换成下一层；
 *   3. 面包屑跳级：点第一级回到根；
 *   4. ESC 关闭，且**不会**把页面退回上一级（捕获阶段拦下）；
 *   5. 背景只压暗（.app-shell opacity ≈ 0.5），没有全屏黑底遮罩；
 *   6. 帝王卡（整卡）与战报里的人名都能开档案；旧的 FigureModal 已不再出现；
 *   7. 帝王档案是结构化的（生平 / 全量要事 / 在位位置），事件注解里的人名能继续下钻。
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
const pageErrors = []
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
  page.on('pageerror', (e) => {
    pageErrors.push(String(e).slice(0, 200))
    console.log('[PAGEERROR]', String(e).slice(0, 160))
  })

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

  /* ---------- 6. 帝王卡整卡入口（不再有独立的「档」按钮） ---------- */
  await page.goto(`${BASE}/dynasty/zhou`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.emp-card', { timeout: 15000 })
  await sleep(900)
  const entry = await page.evaluate(() => ({
    cards: document.querySelectorAll('.emp-card[role="button"]').length,
    legacyBtns: document.querySelectorAll('.emp-codex').length,
  }))
  check(
    '帝王卡整卡即入口（旧「档」按钮已移除）',
    entry.cards > 0 && entry.legacyBtns === 0,
    `${entry.cards} 张可点 / ${entry.legacyBtns} 个旧按钮`,
  )
  await page.evaluate(() => {
    document.querySelector('.emp-card')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await sleep(700)
  const d6 = await drawerState(page)
  check('帝王卡能开档案', d6.count === 1 && d6.kind === '帝王', `${d6.kind}/${d6.name}`)
  check('帝王档案有正文', d6.name.length > 0 && d6.crumbs.length === 1)

  /* ---------- 6b. 结构化档案：生平 / 全量要事 / 在位年数 ---------- */
  const d6b = await page.evaluate(() => ({
    bio: document.querySelector('.codex-drawer .codex-archive-bio')?.textContent?.trim().length ?? 0,
    events: document.querySelectorAll('.codex-drawer .codex-event').length,
    pos: document.querySelector('.codex-drawer .codex-archive-reign')?.textContent?.trim() ?? '',
  }))
  check('帝王档案有「生平」叙述', d6b.bio > 40, `${d6b.bio} 字`)
  check('帝王档案列出全部要事', d6b.events >= 2, `${d6b.events} 条`)
  check('档案标出在位年数与本朝位置', /本朝第/.test(d6b.pos), d6b.pos)

  /* ---------- 7. 典制条目下钻：没有文言原文的条目也必须能渲染 ---------- */
  /* 回归用例：曾经点「秦始皇 → 书同文」整页黑屏（典制条目缺 quotes 字段，
     .map() 抛错 → React 卸掉整棵树）。
     帝王档案改成结构化时间线后，路径变为：点帝王卡 → 展开「书同文·车同轨」事件
     → 点详情里的「相关档案 · 书同文」。验抽屉还在、内容是典制，回归点不变。 */
  await page.goto(`${BASE}/dynasty/qin`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.emp-card', { timeout: 15000 })
  await sleep(900)
  await page.evaluate(() => {
    const card = [...document.querySelectorAll('.emp-card')].find((c) => c.textContent?.includes('秦始皇'))
    card?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await sleep(700)
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('.codex-drawer .codex-event')].find((n) =>
      n.textContent?.includes('书同文'),
    )
    row?.click()
  })
  await sleep(400)
  await page.evaluate(() => {
    const link = [...document.querySelectorAll('.codex-drawer .codex-event-detail .codex-link')].find(
      (n) => n.textContent?.includes('书同文'),
    )
    link?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await sleep(800)
  const d7 = await page.evaluate(() => ({
    drawers: document.querySelectorAll('.codex-drawer').length,
    name: document.querySelector('.codex-drawer .codex-name')?.textContent?.trim() ?? '',
    kind: document.querySelector('.codex-drawer .codex-kind')?.textContent?.trim() ?? '',
    bodyLen: document.querySelector('.codex-drawer .codex-body')?.textContent?.trim().length ?? 0,
    crumbs: [...document.querySelectorAll('.codex-drawer .codex-crumb')].map((n) => n.textContent?.trim()),
    appShell: Boolean(document.querySelector('.app-shell')),
    rootChildren: document.getElementById('root')?.children.length ?? -1,
  }))
  console.log('[D7]', JSON.stringify(d7))
  check('点典制词条后抽屉仍在（不是整页黑屏）', d7.drawers === 1 && d7.appShell && d7.rootChildren > 0, JSON.stringify(d7))
  check('典制条目正常渲染', d7.kind === '典制' && d7.name === '书同文' && d7.bodyLen > 40, `${d7.kind}/${d7.name} body=${d7.bodyLen}`)
  check('典制条目面包屑为两层', d7.crumbs.join('›') === '秦始皇›书同文', d7.crumbs.join('›'))

  /* ---------- 8. 事件详情里的人名可下钻（「五路诸侯都是谁」） ---------- */
  await page.goto(`${BASE}/dynasty/han`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.emp-card', { timeout: 15000 })
  await sleep(900)
  await page.evaluate(() => {
    const card = [...document.querySelectorAll('.emp-card')].find((c) => c.textContent?.includes('漢高祖'))
    card?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await sleep(700)
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('.codex-drawer .codex-event')].find((n) =>
      n.textContent?.includes('垓下'),
    )
    row?.click()
  })
  await sleep(450)
  const d8 = await page.evaluate(() => ({
    links: [...document.querySelectorAll('.codex-event-note-wrap .codex-link')].map((n) =>
      n.textContent?.trim(),
    ),
  }))
  check(
    '事件注解里的人名可点（垓下 → 韩信 / 彭越 / 英布）',
    ['韩信', '彭越', '英布'].every((n) => d8.links.includes(n)),
    d8.links.join('/'),
  )
  await page.evaluate(() => {
    const link = [...document.querySelectorAll('.codex-event-note-wrap .codex-link')].find(
      (n) => n.textContent?.trim() === '彭越',
    )
    link?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await sleep(700)
  const d8b = await page.evaluate(() => ({
    name: document.querySelector('.codex-drawer .codex-name')?.textContent?.trim() ?? '',
    crumbs: [...document.querySelectorAll('.codex-drawer .codex-crumb')].map((n) => n.textContent?.trim()),
  }))
  check('点人名能下钻到人物档案', d8b.name === '彭越', d8b.crumbs.join('›'))

  /* 最后一条：上面每个动作都不许留下页面级异常（黑屏的本质就是异常没被拦下） */
  check('全程没有页面级 JS 异常', pageErrors.length === 0, pageErrors.join(' | '))

  const passed = results.filter((r) => r.pass).length
  console.log(`\n===== ${passed}/${results.length} passed =====`)
  if (passed !== results.length) process.exitCode = 1
} finally {
  await browser.close()
}
