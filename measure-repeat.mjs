/**
 * measure-repeat.mjs —— 判断首帧尖峰是一次性成本还是持续开销
 * ---------------------------------------------------------------------------
 * 连续做 3 次「移出 → 悬浮」，分别采集帧间隔。
 * 若只有第 1 次有尖峰、第 2/3 次干净，说明是一次性栅格化，可用预热消除；
 * 若每次都有，则是持续开销，必须改实现。
 */
import puppeteer from 'puppeteer-core'

const URL = 'http://localhost:5180'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--no-sandbox', '--force-device-scale-factor=1'],
  defaultViewport: { width: 1600, height: 900 },
})

const page = await browser.newPage()
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])
await page.goto(URL, { waitUntil: 'networkidle2' })
await page.waitForSelector('.dyn-panel')
await page.evaluate(() => document.fonts.ready)
await new Promise((r) => setTimeout(r, 3200)) // 留足时间让空闲预热跑完

const box = await page.$eval('.dyn-panel:nth-child(3)', (n) => {
  const r = n.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})

const sample = async (label) => {
  await page.evaluate(() => {
    window.__f = []
    const t0 = performance.now()
    const loop = (t) => {
      window.__f.push(t)
      if (t - t0 < 900) requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
  })
  await page.mouse.move(box.x, box.y, { steps: 1 })
  await new Promise((r) => setTimeout(r, 1100))
  const f = await page.evaluate(() => window.__f)
  const d = f.slice(1).map((t, i) => t - f[i]).filter((x) => x > 0)
  const s = [...d].sort((a, b) => a - b)
  const max = s[s.length - 1]
  console.log(
    `${label}: frames=${d.length} median=${s[Math.floor(s.length / 2)].toFixed(2)}ms p95=${s[Math.floor(s.length * 0.95)].toFixed(2)}ms max=${max.toFixed(2)}ms spikeAt=#${d.indexOf(max)}`,
  )
}

// 第 1 次
await sample('hover #1')
// 移出，等过渡结束
await page.mouse.move(10, 10, { steps: 1 })
await new Promise((r) => setTimeout(r, 900))
await sample('hover #2')
await page.mouse.move(10, 10, { steps: 1 })
await new Promise((r) => setTimeout(r, 900))
await sample('hover #3')

await browser.close()
