/** 骨架七朝的截图证据：时间轴首页 / 末页 / 带器物图的过渡页 / 无图过渡页降级 */
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const BASE = process.env.APP_URL ?? 'http://localhost:5180'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = 'shots/v001'
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

const shot = async (url, file, prep) => {
  await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.pager, .fall-page, .gallery', { timeout: 15000 })
  await sleep(1000)
  if (prep) await prep()
  await page.screenshot({ path: `${OUT}/${file}` })
  console.log(file)
}

await shot('/dynasty/tang', 'tang-p1.png')
await shot('/dynasty/tang', 'tang-last.png', async () => {
  await page.click('[aria-label="第 9 页"]')
  await sleep(900)
})
await shot('/dynasty/sui/fall', 'sui-fall-act1.png')
await shot('/dynasty/five_dynasties/fall', 'fd-fall-act2.png', async () => {
  await page.mouse.move(700, 450)
  await page.mouse.wheel({ deltaY: 220 })
  await sleep(1200)
})
await shot('/dynasty/yuan/fall', 'yuan-fall-noart.png')

await browser.close()
