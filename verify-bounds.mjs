/**
 * verify-bounds.mjs —— 全索引越界回归测试
 * ---------------------------------------------------------------------------
 * 逐个激活全部 13 个模块，每个都校验三件事：
 *   1. 所有模块都完整落在容器内（不被挤出屏幕 / 不产生水平滚动）
 *   2. 没有任何模块被压成不可用的宽度
 *   3. 激活后，鼠标原来的落点仍然落在激活模块内部
 *      （这是"面板不会从光标下滑走"的可操作化定义）
 *
 * 这个用例是为了复现并防止「聚焦明时清被挤出屏幕」那个 bug：
 * 当时采用"左右各承担一半收缩量"，靠近右端时右侧只有 1 块却要吞掉一半收缩量，
 * 被压到下限后总宽对不上，flex 溢出。
 */
import puppeteer from 'puppeteer-core'

const URL = process.env.APP_URL ?? 'http://localhost:5180'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' :: ' + detail : ''}`)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--no-sandbox', '--force-device-scale-factor=1'],
  defaultViewport: { width: 1600, height: 900 },
})

try {
  const page = await browser.newPage()
  await page.setCacheEnabled(false)
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.dyn-panel')
  await page.evaluate(() => document.fonts.ready)
  await sleep(3300)

  const gallery = await page.$eval('.gallery', (n) => {
    const r = n.getBoundingClientRect()
    return { left: r.left, right: r.right }
  })

  const worst = { overflow: 0, minW: 9999, cursorOut: null }

  for (let i = 0; i < 13; i++) {
    // 先移出舞台，清掉上一个激活态
    await page.mouse.move(800, 10, { steps: 2 })
    await sleep(500)

    const box = await page.$eval(`.dyn-panel:nth-child(${i + 1})`, (n) => {
      const r = n.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    })
    await page.mouse.move(box.x, box.y, { steps: 2 })
    await sleep(700)

    const rects = await page.$$eval('.dyn-panel', (ns) =>
      ns.map((n) => {
        const r = n.getBoundingClientRect()
        return { left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width) }
      }),
    )

    const overflowLeft = Math.min(...rects.map((r) => r.left)) - gallery.left
    const overflowRight = Math.max(...rects.map((r) => r.right)) - gallery.right
    const minW = Math.min(...rects.map((r) => r.w))
    const activeRect = rects[i]
    const cursorInside = box.x >= activeRect.left && box.x <= activeRect.right

    console.log(
      `[#${String(i + 1).padStart(2, '0')}] 激活宽=${activeRect.w}px 最窄=${minW}px ` +
        `左溢出=${Math.round(overflowLeft)}px 右溢出=${Math.round(overflowRight)}px 光标在面板内=${cursorInside}`,
    )

    if (overflowLeft < -1 || overflowRight > 1) {
      worst.overflow = Math.max(worst.overflow, Math.abs(overflowLeft), Math.abs(overflowRight))
    }
    worst.minW = Math.min(worst.minW, minW)
    if (!cursorInside && worst.cursorOut === null) worst.cursorOut = i + 1
  }

  check('全部 13 个模块激活时都不越出容器', worst.overflow === 0, `最大溢出 ${worst.overflow}px`)
  check('最窄模块仍可辨识（≥ 60px）', worst.minW >= 60, `最窄 ${worst.minW}px`)
  check('激活后光标仍落在面板内（不会滑走）', worst.cursorOut === null, `首个失败索引 ${worst.cursorOut}`)

  // 专门复现用户报的场景：聚焦「明」，看「清」是否还在屏幕内
  await page.mouse.move(800, 10, { steps: 2 })
  await sleep(500)
  const ming = await page.$eval('.dyn-panel:nth-child(12)', (n) => {
    const r = n.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  await page.mouse.move(ming.x, ming.y, { steps: 2 })
  await sleep(700)
  const qing = await page.$eval('.dyn-panel:nth-child(13)', (n) => {
    const r = n.getBoundingClientRect()
    return { left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width) }
  })
  console.log(`\n[CASE] 聚焦「明」时「清」: left=${qing.left} right=${qing.right} w=${qing.w}px`)
  check('聚焦「明」时「清」仍完整可见', qing.w >= 60 && qing.left < gallery.right, `w=${qing.w}px`)
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.pass)
console.log(`\n===== ${results.length - failed.length}/${results.length} passed =====`)
if (failed.length) {
  console.log('FAILED:')
  for (const f of failed) console.log(` - ${f.name} :: ${f.detail}`)
  process.exitCode = 1
}
