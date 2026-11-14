/**
 * verify-han-visuals.mjs —— 汉朝三个过渡章节的实拍级配图
 * ---------------------------------------------------------------------------
 * 用户要求：汉朝过渡界面必须用新生成的配图，不复用周/秦的旧照片。
 * 这里直接检查三个章节首幕的 <img> 是否已加载、分辨率是否够、是否指向 han-* 资源。
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

  const cases = [
    ['/dynasty/han/fall', '漢魏禅代'],
    ['/dynasty/han/fall/xin', '王莽篡漢'],
    ['/dynasty/han/fall/zhongxing', '光武中兴'],
  ]

  for (const [url, title] of cases) {
    await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle2', timeout: 60000 })
    await page.waitForSelector('.fall-photo')
    await sleep(1200)
    const info = await page.evaluate(() => {
      const img = document.querySelector('.fall-photo')
      return {
        src: img?.getAttribute('src') ?? '',
        w: img?.naturalWidth ?? 0,
        h: img?.naturalHeight ?? 0,
        brand: document.querySelector('.fall-brand-title')?.textContent?.trim(),
      }
    })
    console.log(`[${title}]`, JSON.stringify(info))
    check(`${title}配图已加载且分辨率足够`, info.w >= 1000 && info.h >= 500, `${info.w}x${info.h}`)
    check(`${title}配图使用汉朝专属资源`, info.src.includes('/assets/han-') || info.src.includes('han-'), info.src.slice(0, 80))
  }

  await browser.close()
} catch (err) {
  console.error(err)
  await browser.close()
  process.exitCode = 1
}

const failed = results.filter((r) => !r.pass)
console.log(`\n===== ${results.length - failed.length}/${results.length} passed =====`)
if (failed.length) process.exitCode = 1
