/**
 * verify-song-parallel.mjs —— 宋辽金西夏并立（/dynasty/song/parallel）验收
 * ===========================================================================
 * 这条视图是批次 8 新开的（不动宋的单行时间轴），所以要守的是「另开的东西自成一套」：
 *   1. 入口在宋时间轴顶栏，进得去；
 *   2. 四行（宋 / 辽 / 西夏 / 金）都在，且**未立国的行是空的**（第 1 页西夏、金不该有卡）；
 *   3. 大事索引常驻 8 件、当前页高亮、点节点直接跳到该页（2026-11-21 改：原先只读「本页大事」，
 *      而第 1 页 960—1000 一件大事都没有，页脚整块不渲染）；
 *   4. 宋行的北宋 / 南宋分段色带：段数、段界虚线、两段宽度按年份切分（同上新加）；
 *   5. 点三国任何一张卡 → 抽屉是「君主」档案（不是帝王），有结构化在位要事；
 *   6. 抽屉 ESC 只关抽屉；再 ESC 回宋时间轴；
 *   7. 键盘 ← → 翻页可用；1280 / 1920 不横向溢出；
 *   8. 全程无 JS 异常。
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
      segs: [...r.querySelectorAll('.spt-seg')].map((s) => ({
        text: (s.querySelector('.spt-seg-name')?.textContent ?? '').trim(),
        width: Math.round(s.getBoundingClientRect().width),
      })),
      cuts: r.querySelectorAll('.spt-seg-cut').length,
    }))
    return {
      count: document.querySelector('.spt-count')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      rows,
      nodes: [...document.querySelectorAll('.spt-node')].map((n) => ({
        text: n.textContent.replace(/\s+/g, ''),
        current: n.classList.contains('is-current'),
        tag: n.tagName,
      })),
      phase: document.querySelector('.app-sub')?.textContent?.trim() ?? '',
      url: location.pathname,
    }
  })

const clickNode = async (word) => {
  await page.evaluate((label) => {
    const btn = [...document.querySelectorAll('.spt-node')].find((b) => b.textContent.includes(label))
    if (btn) btn.click()
  }, word)
  await sleep(620)
}

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

  /* ---------------- 3. 大事索引：常驻 + 高亮 + 点击跳页 ---------------- */
  check(
    '第 1 页就有全部 8 件大事（原先本页无大事时整块页脚不渲染）',
    p1.nodes.length === 8 && p1.nodes.every((n) => n.tag === 'BUTTON'),
    `${p1.nodes.length} 件 / ${p1.nodes.map((n) => n.tag).join(',')}`,
  )
  check(
    '第 1 页没有任何节点被高亮（960—1000 无大事）',
    p1.nodes.every((n) => !n.current),
    p1.nodes.filter((n) => n.current).map((n) => n.text).join(','),
  )

  await goPage(2)
  const p2 = await pageState()
  const lit2 = p2.nodes.filter((n) => n.current).map((n) => n.text)
  check(
    '第 2 页高亮 1004 澶渊之盟 与 1038 西夏称帝',
    lit2.length === 2 && lit2.some((t) => t.includes('澶渊之盟')) && lit2.some((t) => t.includes('西夏称帝')),
    lit2.join(' / '),
  )
  check('第 2 页西夏行出现（1038 起）', (p2.rows.find((r) => r.label === '西夏')?.cards.length ?? 0) > 0, String(p2.rows.find((r) => r.label === '西夏')?.cards.length))

  /* 点索引里的「靖康之变」→ 直接跳到它所在的第 5 页（1120—1160） */
  await clickNode('靖康之变')
  const jumped = await pageState()
  check('点「1127 靖康之变」从第 2 页跳到了第 5 页', jumped.count.includes('第 5 / 8'), jumped.count)
  check(
    '跳页后第 5 页的 4 件大事全部高亮（1120 / 1125 / 1127 / 1141）',
    jumped.nodes.filter((n) => n.current).length === 4 &&
      jumped.nodes.find((n) => n.text.includes('靖康之变'))?.current === true,
    jumped.nodes.filter((n) => n.current).map((n) => n.text).join(' / '),
  )

  /* ---------------- 3b. 宋行分段色带（北宋 / 南宋） ---------------- */
  const songRow5 = jumped.rows[0]
  check(
    '第 5 页宋行有北宋 / 南宋两段色带',
    songRow5.segs.length === 2 && songRow5.segs.some((s) => s.text.includes('北宋')) && songRow5.segs.some((s) => s.text.includes('南宋')),
    songRow5.segs.map((s) => `${s.text}(${s.width}px)`).join(' / '),
  )
  check('第 5 页宋行有段界虚线（靖康 1127）', songRow5.cuts === 1, `${songRow5.cuts} 条`)
  check(
    '色带按年份切分：北宋段窄、南宋段宽（1120—1127 vs 1127—1160）',
    songRow5.segs.length === 2 && songRow5.segs[0].width < songRow5.segs[1].width && songRow5.segs[0].width > 100,
    songRow5.segs.map((s) => `${s.text}=${s.width}px`).join(' / '),
  )
  check(
    '第 2 页（1000—1040）宋行只有北宋一段、无段界虚线',
    p2.rows[0].segs.length === 1 && p2.rows[0].segs[0].text.includes('北宋') && p2.rows[0].cuts === 0,
    `${p2.rows[0].segs.length} 段 / ${p2.rows[0].cuts} 条虚线`,
  )
  check(
    '辽夏金三行没有分段色带（只有宋有分段数据）',
    jumped.rows.slice(1).every((r) => r.segs.length === 0),
    jumped.rows.slice(1).map((r) => `${r.label}:${r.segs.length}`).join(' '),
  )

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
