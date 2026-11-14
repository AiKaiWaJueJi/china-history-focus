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

  /* 1) 楚汉沙盘：悬停攻方「汉」应出现"回到战前"提示 */
  await page.goto(`${BASE}/dynasty/qin/endgame`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.map-stage')
  await sleep(1000)
  const box = await page.evaluate(() => {
    const r = document.querySelector('[data-nation="han_base"] .region-hit').getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  await page.mouse.move(box.x, box.y)
  await sleep(500)
  const tip = await page.evaluate(() => ({
    isQinTip: Boolean(document.querySelector('.map-tip.is-qin-tip')),
    text: document.querySelector('.map-tip')?.textContent?.trim() ?? '',
    label: document.querySelector('.map-stage svg')?.getAttribute('aria-label'),
  }))
  check('楚汉悬停攻方「汉」出现回到战前提示', tip.isQinTip, tip.text)
  check('提示文案为「十八王复其疆」', tip.text.includes('十八王复其疆'), tip.text)
  check('楚汉地图 aria-label 为楚汉', tip.label === '楚漢相争版图', String(tip.label))

  /* 2) 楚战报的「史实注记」 */
  await page.goto(`${BASE}/dynasty/zhou/endgame`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('.map-stage')
  await sleep(800)
  const nodes = await page.$$('.rail-node')
  await nodes[4].click() // 楚
  await sleep(1400)
  const note = await page.evaluate(() => {
    const el = document.querySelector('.battle-note')
    return { exists: Boolean(el), text: el?.textContent?.trim() ?? '' }
  })
  check('楚战报出现「史实注记」', note.exists && note.text.includes('史实注记'), note.text)
  check('注记含项燕两说', note.exists && note.text.includes('项燕'), note.text)
  check('注记含楚郡避讳', note.exists && note.text.includes('子楚'), note.text)

  /* 3) 楚汉「还定三秦」战报的图例注 */
  await page.goto(`${BASE}/dynasty/qin/endgame`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('.map-stage')
  await sleep(800)
  const nodes2 = await page.$$('.rail-node')
  await nodes2[1].click()
  await sleep(1400)
  const note2 = await page.evaluate(() => document.querySelector('.battle-note')?.textContent?.trim() ?? '')
  check('楚汉战报注明「图仅示其要者」', note2.includes('图仅示其要者'), note2.slice(0, 80))

  await browser.close()
} catch (err) {
  console.error(err)
  await browser.close()
  process.exitCode = 1
}

const failed = results.filter((r) => !r.pass)
console.log(`\n===== ${results.length - failed.length}/${results.length} passed =====`)
if (failed.length) process.exitCode = 1

