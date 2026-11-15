import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const BASE = process.env.APP_URL ?? 'http://localhost:5180'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = 'shots/v004'
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
for (const [dyn, file] of [
  ['tang', 'tang-endgame.png'],
  ['yuan', 'yuan-endgame.png'],
  ['ming', 'ming-endgame.png'],
  ['qing', 'qing-endgame.png'],
]) {
  await page.goto(`${BASE}/dynasty/${dyn}/endgame`, { waitUntil: 'networkidle2', timeout: 60000 })
  await sleep(1500)
  await page.screenshot({ path: `${OUT}/${file}` })
  console.log(file)
}
await browser.close()
