/**
 * verify-codex-index.mjs —— 档案总目（/codex）交互验收
 * ===========================================================================
 * 这一页解决的是「359 条只能顺链子点」的问题，所以验收也要盯**检索行为**而不是装饰：
 *   1. 主页顶栏进得去（/codex），顶栏提示跟着变；
 *   2. 总数与生成物一致（codex.entries.json 的条目数）；
 *   3. 默认排序是通史顺序（周在前、帝王在战役之前），不是拼音字典；
 *   4. 搜「井陉」能召回楚漢与战国的条目，且名字命中排在正文命中之前；
 *   5. 类型 / 朝代筛选真的收窄，且计数跟着变；
 *   6. 点一行 = 开抽屉（唯一阅读界面），ESC 只关抽屉、不离开本页；
 *   7. 搜索框内 ESC 先清空搜索，再 ESC 才回主页；
 *   8. 全程无 pageerror / console.error。
 */
import { readFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const BASE = process.env.APP_URL ?? 'http://localhost:5180'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const EXPECTED = JSON.parse(readFileSync('src/data/codex.entries.json', 'utf8')).entries.length

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--no-sandbox', '--force-device-scale-factor=1'],
  defaultViewport: { width: 1440, height: 900 },
})
const page = await browser.newPage()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const errors = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' :: ' + detail : ''}`)
}

page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`)
})

const rows = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('.codex-row')].map((r) => ({
      kind: r.querySelector('.codex-row-kind')?.textContent?.trim() ?? '',
      name: r.querySelector('.codex-row-name')?.textContent?.trim() ?? '',
      meta: r.querySelector('.codex-row-meta')?.textContent?.trim() ?? '',
    })),
  )
const count = () => page.evaluate(() => document.querySelector('.codex-index-count')?.textContent?.trim() ?? '')
const typeSearch = async (text) => {
  await page.click('input[type="search"]')
  await page.evaluate(() => {
    const el = document.querySelector('input[type="search"]')
    el.value = ''
  })
  await page.type('input[type="search"]', text)
  await sleep(260)
}

try {
  /* ---------------- 1. 入口 ---------------- */
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
  await sleep(500)
  const nav = await page.$eval('.app-nav', (el) => ({
    text: el.textContent.trim(),
    href: el.getAttribute('href') ?? '',
  }))
  check('主页顶栏有「档案总目」入口', nav.text === '档案总目' && nav.href.endsWith('/codex'), `${nav.text} → ${nav.href}`)

  await page.click('.app-nav')
  await sleep(700)
  check('点入口进入 /codex', page.url().endsWith('/codex'), page.url())
  const phase = await page.$eval('.app-sub', (el) => el.textContent.trim())
  check('顶栏提示跟着换成 codex index', phase === 'codex index', phase)

  /* ---------------- 2. 总量 ---------------- */
  const headSub = await page.$eval('.codex-index-sub', (el) => el.textContent.replace(/\s+/g, ' ').trim())
  check('全库总量与生成物一致', headSub.includes(`全库 ${EXPECTED} 条`), `期望 ${EXPECTED}，页面「${headSub}」`)

  /* ---------------- 3. 默认排序 ---------------- */
  const first = (await rows()).slice(0, 3)
  check(
    '默认排序按通史顺序（周朝帝王在前）',
    first[0]?.kind === '帝王' && first[0]?.name.startsWith('周'),
    first.map((r) => `${r.kind}/${r.name}`).join(' · '),
  )

  /* ---------------- 4. 检索召回 ---------------- */
  await typeSearch('井陉')
  const hits = await rows()
  check('搜「井陉」有召回', hits.length > 0 && hits.length <= 12, `${hits.length} 条`)
  check(
    '搜「井陉」能同时命中楚漢与战国两条战役',
    hits.some((r) => r.name === '井陉破赵') && hits.some((r) => r.name === '秦灭赵'),
    hits.map((r) => r.name).slice(0, 4).join(' / '),
  )
  const countText = await count()
  check('检索结果计数与列表条数一致', countText.includes(`命中 ${hits.length} 条`), countText)

  /* 名字命中优先于正文命中：搜「韩信」时第一条必须是人物「韩信」 */
  await typeSearch('韩信')
  const hanxin = (await rows())[0]
  check('名字命中排在正文命中之前', hanxin?.name === '韩信', hanxin?.name ?? '(空)')

  /* ---------------- 5. 筛选 ---------------- */
  await page.evaluate(() => document.querySelector('.codex-index-clear')?.click())
  await sleep(220)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.codex-filter')].find((b) => b.textContent.trim().startsWith('战役'))
    btn.click()
  })
  await sleep(280)
  const battleRows = await rows()
  check('类型筛选「战役」只剩战役', battleRows.length > 0 && battleRows.every((r) => r.kind === '战役'), `${battleRows.length} 条`)

  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.codex-filter')].find((b) => b.textContent.trim() === '明')
    btn.click()
  })
  await sleep(280)
  const mingRows = await rows()
  check(
    '叠加朝代筛选「明」后只剩明朝条目',
    mingRows.length > 0 && mingRows.every((r) => r.meta.startsWith('明')),
    `${mingRows.length} 条`,
  )

  /* ---------------- 6. 点行开抽屉 ---------------- */
  await page.evaluate(() => document.querySelectorAll('.codex-row')[0].click())
  await sleep(620)
  const drawer = await page.evaluate(() => ({
    open: Boolean(document.querySelector('.codex-drawer')),
    name: document.querySelector('.codex-drawer .codex-name')?.textContent?.trim() ?? '',
    stillIndex: Boolean(document.querySelector('.codex-index')),
  }))
  check('点一行打开抽屉且本页仍在', drawer.open && drawer.stillIndex, drawer.name)

  await page.keyboard.press('Escape')
  await sleep(520)
  const afterEsc = await page.evaluate(() => ({
    drawer: Boolean(document.querySelector('.codex-drawer')),
    url: location.pathname,
  }))
  check('ESC 只关抽屉，不离开 /codex', !afterEsc.drawer && afterEsc.url === '/codex', afterEsc.url)

  /* ---------------- 7. ESC 语义：先清搜索再回主页 ---------------- */
  await typeSearch('商鞅')
  await sleep(200)
  await page.focus('input[type="search"]')
  await page.keyboard.press('Escape')
  await sleep(280)
  const afterClear = await page.evaluate(() => ({
    value: document.querySelector('input[type="search"]')?.value ?? '',
    url: location.pathname,
  }))
  check('搜索框内 ESC 先清空关键词', afterClear.value === '' && afterClear.url === '/codex', `${afterClear.url} 值「${afterClear.value}」`)

  await page.keyboard.press('Escape')
  await sleep(620)
  check('再按 ESC 回到朝代主页', page.url().endsWith('/'), page.url())

  /* ---------------- 8. 键盘可达 ---------------- */
  await page.goto(`${BASE}/codex`, { waitUntil: 'networkidle2' })
  await sleep(400)
  const labelled = await page.evaluate(() => {
    const input = document.querySelector('input[type="search"]')
    return Boolean(input && input.getAttribute('aria-label'))
  })
  check('检索框有可读标签（aria-label）', labelled)

  const live = await page.evaluate(() => document.querySelector('.codex-index-count')?.getAttribute('aria-live'))
  check('结果计数是 aria-live（读屏能听到命中变化）', live === 'polite', String(live))

  /* ---------------- 9. 无异常 ---------------- */
  check('全程无 JS 异常 / console.error', errors.length === 0, errors.slice(0, 2).join(' | '))
} finally {
  const passed = results.filter((r) => r.pass).length
  console.log(`\n===== ${passed}/${results.length} passed =====`)
  await browser.close()
  if (passed !== results.length) process.exitCode = 1
}
