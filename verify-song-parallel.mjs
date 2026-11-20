/**
 * verify-song-parallel.mjs —— 宋辽金西夏并立（/dynasty/song/parallel）验收
 * ===========================================================================
 * 这条视图是批次 8 新开的（不动宋的单行时间轴），所以要守的是「另开的东西自成一套」：
 *   1. 入口在宋时间轴顶栏，进得去；
 *   2. 四行（宋 / 辽 / 西夏 / 金）都在，且**未立国的行是空的**（第 1 页西夏、金不该有卡）；
 *   3. 八个窗口翻页与「本页大事」节点对得上（第 2 页 1004 澶渊之盟、1038 西夏称帝）；
 *   4. 点三国任何一张卡 → 抽屉是「君主」档案（不是帝王），有结构化在位要事；
 *   5. 抽屉 ESC 只关抽屉；再 ESC 回宋时间轴；
 *   6. 键盘 ← → 翻页可用；1280 / 1920 不横向溢出；
 *   7. 全程无 JS 异常。
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

const pageState = () =>
  page.evaluate(() => {
    const rows = [...document.querySelectorAll('.spt-row')].map((r) => ({
      label: r.querySelector('.spt-label-name')?.textContent?.trim() ?? '',
      cards: [...r.querySelectorAll('.spt-card')].map((c) =>
        (c.querySelector('.spt-card-title')?.textContent ?? '').trim(),
      ),
    }))
    return {
      count: document.querySelector('.spt-count')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      rows,
      nodes: [...document.querySelectorAll('.spt-node')].map((n) => n.textContent.replace(/\s+/g, '')),
      phase: document.querySelector('.app-sub')?.textContent?.trim() ?? '',
      url: location.pathname,
    }
  })

/**
 * 翻到第 n 页。翻页有 520ms 冷却（useWheelPaging），连点会被吞——
 * 所以这里一次只点一步、等到页码真的变了再点下一步。
 */
const currentPage = () =>
  page.evaluate(() => {
    const m = /第 (\d+) \/ (\d+) 页/.exec(document.querySelector('.spt-count')?.textContent ?? '')
    return m ? Number(m[1]) : 0
  })

const goPage = async (n) => {
  for (let guard = 0; guard < 12; guard += 1) {
    const now = await currentPage()
    if (now === n) return
    const dir = now < n ? '下一页' : '上一页'
    await page.evaluate((label) => {
      const btn = [...document.querySelectorAll('.spt-btn')].find((b) => b.textContent.includes(label))
      btn?.click()
    }, dir)
    await sleep(620)
  }
}

try {
  /* ---------------- 1. 入口 ---------------- */
  await page.goto(`${BASE}/dynasty/song`, { waitUntil: 'networkidle2' })
  await sleep(800)
  const entry = await page.evaluate(() => {
    const b = document.querySelector('.timeline-btn--parallel')
    return { exists: Boolean(b), text: b?.textContent?.trim() ?? '' }
  })
  check('宋时间轴顶栏有并行视图入口', entry.exists && entry.text.includes('并立'), entry.text)

  await page.evaluate(() => document.querySelector('.timeline-btn--parallel').click())
  await sleep(900)
  const p1 = await pageState()
  check('入口落在 /dynasty/song/parallel', p1.url === '/dynasty/song/parallel', p1.url)
  check('顶栏 phase 为 parallel timeline', p1.phase === 'parallel timeline', p1.phase)
  check(
    '标题与计数正确',
    p1.count.includes('宋 18 帝') && p1.count.includes('辽 9 帝') && p1.count.includes('西夏 10 帝') && p1.count.includes('金 10 帝'),
    p1.count,
  )

  /* ---------------- 2. 四行与「未立国为空」 ---------------- */
  const labels = p1.rows.map((r) => r.label)
  check('四行齐（宋 / 辽 / 西夏 / 金）', labels.join(',') === '宋,辽,西夏,金', labels.join(','))
  check(
    '第 1 页宋有卡、辽有卡、西夏与金为空（未立国）',
    p1.rows[0].cards.length === 3 && p1.rows[1].cards.length >= 2 && p1.rows[2].cards.length === 0 && p1.rows[3].cards.length === 0,
    p1.rows.map((r) => `${r.label}:${r.cards.length}`).join(' '),
  )

  /* ---------------- 3. 翻页与节点 ---------------- */
  await goPage(2)
  const p2 = await pageState()
  check('第 2 页有「1004 澶渊之盟」「1038 西夏称帝」节点', p2.nodes.some((n) => n.includes('澶渊之盟')) && p2.nodes.some((n) => n.includes('西夏称帝')), p2.nodes.join(' / '))
  check('第 2 页西夏行出现（1038 起）', (p2.rows.find((r) => r.label === '西夏')?.cards.length ?? 0) > 0, String(p2.rows.find((r) => r.label === '西夏')?.cards.length))

  await goPage(4)
  const p4 = await pageState()
  check('第 4 页金行出现（1115 起）', (p4.rows.find((r) => r.label === '金')?.cards.length ?? 0) > 0, JSON.stringify(p4.rows.find((r) => r.label === '金')))

  /* ---------------- 4. 点卡 → 君主档案 ---------------- */
  await goPage(2)
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('.spt-row')].find((r) => r.querySelector('.spt-label-name')?.textContent?.trim() === '辽')
    row?.querySelector('.spt-card')?.click()
  })
  await sleep(800)
  const drawer = await page.evaluate(() => ({
    open: Boolean(document.querySelector('.codex-drawer')),
    kind: document.querySelector('.codex-drawer .codex-kind')?.textContent?.trim() ?? '',
    name: document.querySelector('.codex-drawer .codex-name')?.textContent?.trim() ?? '',
    reign: document.querySelector('.codex-archive-reign')?.textContent?.trim() ?? '',
    events: document.querySelectorAll('.codex-drawer .codex-event').length,
  }))
  check('点辽帝卡打开君主档案', drawer.open && drawer.kind === '君主', `${drawer.kind}/${drawer.name}`)
  check('君主档案是结构化的（在位年 + 在位要事）', drawer.reign.includes('在位') && drawer.events > 0, `${drawer.reign} · ${drawer.events} 条`)

  await page.keyboard.press('Escape')
  await sleep(500)
  const afterEsc = await page.evaluate(() => ({ drawer: Boolean(document.querySelector('.codex-drawer')), url: location.pathname }))
  check('ESC 只关抽屉，仍在并行视图', !afterEsc.drawer && afterEsc.url === '/dynasty/song/parallel', afterEsc.url)

  await page.keyboard.press('Escape')
  await sleep(700)
  check('再 ESC 回宋时间轴', page.url().endsWith('/dynasty/song'), page.url())

  /* ---------------- 5. 键盘翻页 ---------------- */
  await page.goto(`${BASE}/dynasty/song/parallel`, { waitUntil: 'networkidle2' })
  await sleep(700)
  const before = (await pageState()).count
  await page.keyboard.press('ArrowRight')
  await sleep(800)
  const after = (await pageState()).count
  check('→ 键能翻页', before.includes('第 1 / 8') && after.includes('第 2 / 8'), `${before} → ${after}`)

  /* ---------------- 6. 换屏不溢出 ---------------- */
  const overflow = []
  for (const [w, h] of [[1280, 720], [1920, 1080]]) {
    await page.setViewport({ width: w, height: h })
    await sleep(500)
    const m = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      win: window.innerWidth,
    }))
    overflow.push(`${w}:${m.doc}/${m.win}`)
    if (m.doc > m.win + 1) throw new Error(`${w}×${h} 横向溢出 ${m.doc}>${m.win}`)
  }
  check('1280×720 / 1920×1080 不横向溢出', true, overflow.join(' | '))

  check('全程无 JS 异常 / console.error', errors.length === 0, errors.slice(0, 2).join(' | '))
} catch (err) {
  console.error(err)
  check('脚本执行未抛错', false, String(err).slice(0, 120))
} finally {
  const passed = results.filter((r) => r.pass).length
  console.log(`\n===== ${passed}/${results.length} passed =====`)
  await browser.close()
  if (passed !== results.length) process.exitCode = 1
}
