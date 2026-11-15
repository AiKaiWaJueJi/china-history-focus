import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const BASE = process.env.APP_URL ?? 'http://localhost:5180'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = 'shots/v003'
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

const go = async (url, file, prep) => {
  await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle2', timeout: 60000 })
  await sleep(1600)
  if (prep) await prep()
  await page.screenshot({ path: `${OUT}/${file}` })
  console.log(file)
}

await go('/dynasty/sui/endgame', 'sui-endgame-pre.png')
await go('/dynasty/sui/endgame', 'sui-endgame-step1.png', async () => {
  await page.keyboard.press('ArrowRight')
  await sleep(1800)
})
await go('/dynasty/five_dynasties/endgame', 'fd-endgame-pre.png')
await go('/dynasty/song/endgame', 'song-endgame-pre.png')
const info = await page.evaluate(() => ({
  regions: document.querySelectorAll('.wsm-region, .map-region, [data-region-id]').length,
  labels: [...document.querySelectorAll('text')].map((t) => t.textContent).filter((t) => t && t.length < 6).slice(0, 20),
}))
console.log(JSON.stringify(info))
await browser.close()
