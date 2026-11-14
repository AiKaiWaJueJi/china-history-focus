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

try {
  const page = await browser.newPage()
  await page.setCacheEnabled(false)
  page.on('pageerror', (e) => console.log('[PAGEERROR]', String(e).slice(0, 160)))
  await page.goto(`${BASE}/dynasty/han/endgame`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.map-stage')
  await sleep(1100)

  const start = await page.evaluate(() => ({
    title: document.querySelector('.endgame-title')?.textContent?.trim(),
    sub: document.querySelector('.endgame-sub')?.textContent?.trim(),
    rail: [...document.querySelectorAll('.rail-node')].map((n) => n.textContent?.replace(/\s+/g, ' ').trim()),
    regions: [...document.querySelectorAll('.region-hit')].map((n) => n.parentElement?.getAttribute('data-nation')),
    unborn: document.querySelectorAll('.region-unborn').length,
    label: document.querySelector('.map-stage svg')?.getAttribute('aria-label'),
    attackerLabel: document.querySelector('.region-label--qin')?.textContent?.trim(),
  }))
  console.log('[START]', JSON.stringify(start))
  check('沙盘标题为「三国归晋」', start.title === '三国归晋', start.title)
  check('战前为 229 年（孙权称帝、三国鼎立）', (start.rail[0] ?? '').includes('229'), start.rail[0])
  check('节点为 辽东/蜀/吴 三幕', (start.rail.slice(1).join(',')).includes('辽东238,蜀263,吴280'), start.rail.slice(1).join(','))
  check('战前即显示魏蜀吴辽东四块', start.regions.length === 4, JSON.stringify(start.regions))
  check('战前没有未登场幽灵块', start.unborn === 0, String(start.unborn))
  check('三国地图 aria-label 生效', start.label === '三国鼎立版图', String(start.label))
  check('战前攻方国号为魏', start.attackerLabel === '魏', String(start.attackerLabel))

  /* 点「辽东」节点：辽东应在 238 幕被吞并，且魏蜀吴仍在图上 */
  const nodes1 = await page.$$('.rail-node')
  await nodes1[1].click()
  await sleep(1400)
  const liao = await page.evaluate(() => ({
    captured: document.querySelector('[data-nation="liaodong"]')?.getAttribute('data-captured'),
    regions: [...document.querySelectorAll('.region-hit')].length,
  }))
  console.log('[LIAODONG]', JSON.stringify(liao))
  check('辽东在 238 幕归魏', liao.captured === 'true', JSON.stringify(liao))
  check('辽东幕地图为四块', liao.regions === 4, String(liao.regions))

  /* 悬停攻方「魏」：应出现回到战前的提示 */
  await page.keyboard.press('Escape')
  await sleep(500)
  const weiBox = await page.evaluate(() => {
    const r = document.querySelector('[data-nation="wei"] .region-hit').getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  await page.mouse.move(weiBox.x, weiBox.y)
  await sleep(500)
  const weiTip = await page.evaluate(() => document.querySelector('.map-tip.is-qin-tip')?.textContent?.trim() ?? '')
  check('三国悬停「魏」出现回到战前提示', weiTip.includes('三国复其疆'), weiTip)

  /* 点「蜀」节点 → 战报 */
  const nodes = await page.$$('.rail-node')
  await nodes[2].click()
  await sleep(1500)
  const report = await page.evaluate(() => {
    const t = document.querySelector('.battle-panel')?.textContent ?? ''
    return {
      hasDengai: t.includes('邓艾'),
      hasYinping: t.includes('阴平'),
      source: [...document.querySelectorAll('.source-book')].map((n) => n.textContent?.trim()),
      regions: [...document.querySelectorAll('.region-hit')].map((n) => n.parentElement?.getAttribute('data-nation')),
      note: document.querySelector('.battle-note')?.textContent?.trim() ?? '',
    }
  })
  console.log('[SHU]', JSON.stringify({ hasDengai: report.hasDengai, source: report.source, regions: report.regions }))
  check('蜀战报含邓艾与阴平', report.hasDengai && report.hasYinping)
  check('蜀战报引《邓艾传》', report.source.some((s) => (s ?? '').includes('邓艾传')), report.source.join('|'))
  check('蜀幕地图已有四块（蜀吴登场）', report.regions.length >= 3, JSON.stringify(report.regions))

  /* 推到最后：一统者应为「晋」 */
  await page.keyboard.press('Escape')
  await sleep(500)
  const nodes2 = await page.$$('.rail-node')
  await nodes2[nodes2.length - 1].click()
  await sleep(1600)
  const jinLabel = await page.evaluate(() => document.querySelector('.region-label--qin')?.textContent?.trim())
  check('灭吴时攻方国号为晋（265 已代魏）', jinLabel === '晋', String(jinLabel))
  await page.keyboard.press('Escape')
  await sleep(700)
  await page.mouse.move(700, 500)
  await page.mouse.wheel({ deltaY: 260 })
  await sleep(1800)
  const finale = await page.evaluate(() => ({
    char: document.querySelector('.unify-char')?.textContent?.trim(),
    entry: document.querySelector('.qin-entry')?.textContent?.replace(/\s+/g, ' ').trim(),
  }))
  console.log('[FINALE]', JSON.stringify(finale))
  check('终章大字为「晋」', finale.char === '晋', String(finale.char))
  check('出现下一朝「晋」入口', (finale.entry ?? '').includes('晋'), String(finale.entry))

  await browser.close()
} catch (err) {
  console.error(err)
  await browser.close()
  process.exitCode = 1
}
const failed = results.filter((r) => !r.pass)
console.log(`\n===== ${results.length - failed.length}/${results.length} passed =====`)
if (failed.length) process.exitCode = 1
