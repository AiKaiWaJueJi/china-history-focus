/** 五代十国并行时间轴截图 */
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const BASE = process.env.APP_URL ?? 'http://localhost:5180'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = 'shots/v002'
mkdirSync(OUT, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--no-sandbox', '--force-device-scale-factor=1'],
  defaultViewport: { width: 1440, height: 900 },
})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const page = await browser.newPage()
await page.setCacheEnabled(false)
page.on('pageerror', (e) => console.log('[PAGEERROR]', String(e).slice(0, 200)))

await page.goto(`${BASE}/dynasty/five_dynasties`, { waitUntil: 'networkidle2', timeout: 60000 })
await page.waitForSelector('.wdc-stage', { timeout: 15000 })
await sleep(1200)
await page.screenshot({ path: `${OUT}/wudai-p1.png` })

for (const [i, n] of [[1, 2], [2, 3], [3, 4], [4, 5]]) {
  await page.click(`[aria-label="第 ${n} 页"]`)
  await sleep(900)
  await page.screenshot({ path: `${OUT}/wudai-p${n}.png` })
}

const info = await page.evaluate(() => ({
  rows: document.querySelectorAll('.wdc-row').length,
  cards: document.querySelectorAll('.wdc-card').length,
  polities: [...document.querySelectorAll('.wdc-polity')].map((n) => n.textContent?.trim()),
  count: document.querySelector('.wdc-count')?.textContent?.trim(),
}))
console.log(JSON.stringify(info, null, 2))

await browser.close()
