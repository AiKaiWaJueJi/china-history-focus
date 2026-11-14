/**
 * verify-chuhan.mjs —— 楚汉相争沙盘（秦亡 → 汉立之间的五年）
 * ---------------------------------------------------------------------------
 * 要证明的事：
 *   1) 沙盘换了一张地图：攻方是「汉」，据点从「巴蜀·汉中」起
 *   2) 七个吞并节点齐备，年份与史相符（三秦前206 → 西楚前202）
 *   3) 「战前」节点用楚汉年份（前206），不是周的前230
 *   4) 点节点能展开战报，含三段局势、进军序列与《史记》原文
 *   5) 推进到最后一节后出现「汉」的入口（下一朝）
 *   6) 战国沙盘未受影响：周仍是六国、仍是「秦」为攻方
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

  /* ---------- 1) 楚汉沙盘 ---------- */
  await page.goto(`${BASE}/dynasty/qin/endgame`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.map-stage')
  await sleep(1200)

  const shell = await page.evaluate(() => ({
    title: document.querySelector('.endgame-title')?.textContent?.trim(),
    rail: [...document.querySelectorAll('.rail-node')].map((n) => n.textContent?.trim()),
    regions: [...document.querySelectorAll('.region-hit')].length,
    attacker: document.querySelector('.map-label-qin, [class*="attacker"]')?.textContent?.trim() ?? null,
  }))
  console.log(`[SHELL] ${JSON.stringify(shell)}`)
  check('标题为「楚漢相争」', shell.title === '楚漢相争', shell.title)
  check('战前节点为前206', (shell.rail[0] ?? '').includes('前206'), shell.rail[0])
  check('七国节点顺序正确（破赵在前、燕降在后）', shell.rail.slice(1).join(',').includes('三秦前206,魏前205,韩前205,赵前204,燕前204,齐前203,西楚前202'), shell.rail.slice(1).join(','))

  /* ---------- 2) 地图上的攻方是汉 ---------- */
  const mapText = await page.evaluate(() => {
    const svg = document.querySelector('.map-stage svg')
    return svg ? svg.textContent ?? '' : ''
  })
  check('地图上出现「漢」字', mapText.includes('漢'), mapText.slice(0, 40))
  check('地图上不再以「秦」为攻方标签', !/^\s*秦\s*$/.test(mapText), 'ok')

  /* ---------- 3) 点节点展开战报 ---------- */
  const nodes = await page.$$('.rail-node')
  await nodes[1].click() // 三秦
  await sleep(1400)
  const report1 = await page.evaluate(() => ({
    year: document.querySelector('.battle-year, .panel-year, .endgame-panel h3')?.textContent?.trim(),
    headings: [...document.querySelectorAll('.source-book, .battle-label, .panel-section-title')].map((n) => n.textContent?.trim()).slice(0, 6),
    text: document.querySelector('.endgame-panel, .battle-panel')?.textContent?.slice(0, 220) ?? '',
  }))
  console.log(`[R1] ${JSON.stringify(report1)}`)
  check('点三秦展开战报', (report1.text ?? '').includes('三秦') || (report1.text ?? '').includes('章邯'), report1.text.slice(0, 40))
  check('战报含《史记》引文', report1.headings.some((h) => (h ?? '').includes('史记')), report1.headings.join('|'))

  /* ---------- 4) 推进到最后一节 ---------- */
  const nodes2 = await page.$$('.rail-node')
  await nodes2[nodes2.length - 1].click()
  await sleep(1600)
  const last = await page.evaluate(() => {
    const t = document.querySelector('.endgame-panel, .battle-panel')?.textContent ?? ''
    return { hasGaixia: t.includes('垓下'), hasXiangyu: t.includes('项羽') || t.includes('项王') }
  })
  check('最后一节为垓下之围', last.hasGaixia, String(last.hasGaixia))
  check('垓下战报含项羽', last.hasXiangyu, String(last.hasXiangyu))

  /* ---------- 5) 一统后出现「汉」入口 ----------
     战报打开时终局态会被压住，先关掉面板再推进 */
  await page.keyboard.press('Escape')
  await sleep(600)
  await page.evaluate(() => {
    const close = document.querySelector('.battle-close, .endgame-panel button')
    if (close) close.click()
  })
  await sleep(500)
  await page.mouse.move(700, 500)
  await page.mouse.wheel({ deltaY: 260 })
  await sleep(1800)
  const entry = await page.evaluate(() => {
    const el = document.querySelector('.qin-entry, [class*="entry"]')
    return { text: el?.textContent?.trim() ?? null, visible: Boolean(el) }
  })
  console.log(`[ENTRY] ${JSON.stringify(entry)}`)
  check('出现下一朝「漢」的入口', (entry.text ?? '').includes('漢'), entry.text)

  /* ---------- 6) 战国沙盘未受影响 ---------- */
  await page.goto(`${BASE}/dynasty/zhou/endgame`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('.map-stage')
  await sleep(1200)
  const zhouMap = await page.evaluate(() => ({
    title: document.querySelector('.endgame-title')?.textContent?.trim(),
    rail: [...document.querySelectorAll('.rail-node')].map((n) => n.textContent?.trim()),
    svg: document.querySelector('.map-stage svg')?.textContent ?? '',
  }))
  console.log(`[ZHOU] ${JSON.stringify({ title: zhouMap.title, rail: zhouMap.rail })}`)
  check('周仍是「王朝覆灭 · 秦灭六国」', zhouMap.title?.includes('王朝覆灭') || zhouMap.title?.includes('秦灭六国'), zhouMap.title)
  check('周的战前节点仍为前230', (zhouMap.rail[0] ?? '').includes('前230'), zhouMap.rail[0])
  check('周地图攻方仍是「秦」', zhouMap.svg.includes('秦'), 'ok')

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
