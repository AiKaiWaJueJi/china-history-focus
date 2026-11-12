/**
 * capture-report.mjs —— 为交付文档批量截图
 * ---------------------------------------------------------------------------
 * 覆盖视图二（帝王时间轴 → 时代分段 → 天子/诸侯双层 → 王朝覆灭 → 一统）
 * 的完整操作链路。每张都是真实运行状态，不是示意图。
 */
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const URL = process.env.APP_URL ?? 'http://localhost:5180'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = 'D:\\文档\\deepseek-harness\\default-workspace\\china-history-focus\\shots\\report'
mkdirSync(OUT, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
/** 截图默认态前先把指针挪到页眉，避免拍成悬浮态 */
const neutral = async (page, ms = 650) => {
  await page.mouse.move(800, 40, { steps: 2 })
  await sleep(ms)
}
const shot = async (page, name) => {
  await page.screenshot({ path: `${OUT}\\${name}.png` })
  console.log(`  ✓ ${name}.png`)
}

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

  /* ---------------- A. 从主页进入时间轴 ---------------- */
  console.log('[A] 主页 → 周朝时间轴')
  await page.goto(`${URL}/`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.dyn-panel')
  await page.evaluate(() => document.fonts.ready)
  await sleep(3000)
  await shot(page, '01-gallery')

  const zhouBox = await page.$eval('.dyn-panel:nth-child(1)', (n) => {
    const r = n.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  await page.mouse.move(zhouBox.x, zhouBox.y, { steps: 2 })
  await sleep(800)
  await shot(page, '02-gallery-focus')
  await page.mouse.click(zhouBox.x, zhouBox.y)
  await sleep(1200)
  await page.waitForSelector('.emp-card')
  await sleep(1200)

  /* ---------------- B. 帝王时间轴（西周 · 单层） ---------------- */
  console.log('[B] 帝王时间轴')
  await neutral(page)
  await shot(page, '03-timeline-xizhou')

  // 悬浮第一位帝王：上下思维导图
  const card1 = await page.$eval('.emp-card:nth-child(1)', (n) => {
    const r = n.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  await page.mouse.move(card1.x, card1.y, { steps: 2 })
  await sleep(900)
  await shot(page, '04-timeline-hover')

  // 翻页过渡中的一帧（两页重叠，用来体现"没有黑场"）
  await page.mouse.move(800, 60, { steps: 2 })
  await sleep(700)
  await page.mouse.move(800, 450)
  await page.mouse.wheel({ deltaY: 220 })
  await sleep(170)
  await shot(page, '05-page-transition')
  await sleep(1000)

  /* ---------------- C. 时代分段轴 ---------------- */
  console.log('[C] 时代分段轴 / 春秋节点')
  await page.$$eval('.seg-marker', (ns) => ns[1].click()) // 跳战国（第 9 页：吴、越在位）
  await sleep(1400)
  await neutral(page)
  await shot(page, '06-segment-axis')

  /* ---------------- D. 东周双层（天子 + 诸侯） ---------------- */
  console.log('[D] 双层布局 / 诸侯挤压')
  await page.$$eval('.seg-marker', (ns) => ns[1].click()) // 跳战国
  await sleep(1400)
  await page.$$eval('.timeline-dot', (ns, i) => ns[i].click(), 5) // 第 6 页：齐桓 + 晋文
  await sleep(1200)
  await neutral(page)
  await shot(page, '07-dual-layout')

  const lord = await page.$eval('.lord-card:nth-child(2)', (n) => {
    const r = n.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  await page.mouse.move(lord.x, lord.y, { steps: 3 })
  await sleep(900)
  await shot(page, '08-lord-squeeze')

  // 无霸主的空窗期
  await page.mouse.move(800, 60, { steps: 2 })
  await sleep(600)
  await page.$$eval('.timeline-dot', (ns, i) => ns[i].click(), 7)
  await sleep(1200)
  await shot(page, '09-lords-empty')

  /* ---------------- E. 王朝覆灭 ---------------- */
  console.log('[E] 王朝覆灭')
  await page.goto(`${URL}/dynasty/zhou/endgame`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('.map-stage')
  await page.evaluate(() => document.fonts.ready)
  await sleep(1200)
  await neutral(page)
  await shot(page, '10-endgame-idle')

  // 悬浮要点卡片
  const zhao = await page.evaluate(() => {
    const el = document.querySelector('[data-nation="zhao"] .region-base')
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  await page.mouse.move(zhao.x, zhao.y, { steps: 3 })
  await sleep(500)
  await shot(page, '11-endgame-hover')

  // 点击展开战报（先截一张展开中间帧，体现动画）
  await page.mouse.click(zhao.x, zhao.y)
  await sleep(120)
  await shot(page, '12-panel-opening')
  await sleep(900)
  await shot(page, '13-endgame-detail')

  // 人物 Modal
  await page.click('.battle-panel .figure-tag')
  await sleep(600)
  await shot(page, '14-figure-modal')
  await page.keyboard.press('Escape')
  await sleep(500)
  await page.evaluate(() => {
    document.querySelector('.map-bg').dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await sleep(600)

  /* ---------------- F. 逆推回退 ---------------- */
  console.log('[F] 回退到 index 2')
  await page.evaluate(() => document.querySelectorAll('.rail-node')[2].click()) // 赵
  await sleep(1200)
  await neutral(page)
  await shot(page, '15-rewind')

  // 悬浮已灭国：原疆域鎏金
  const han = await page.evaluate(() => {
    const el = document.querySelector('[data-nation="han"] .region-base')
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  await page.mouse.move(han.x, han.y, { steps: 3 })
  await sleep(600)
  await shot(page, '16-conquered-hover')
  await page.mouse.move(800, 120, { steps: 2 })
  await sleep(400)

  /* ---------------- G. 一统终章 ---------------- */
  console.log('[G] 一统终章')
  await page.evaluate(() => document.querySelectorAll('.rail-node')[6].click()) // 齐
  await sleep(1200)
  await shot(page, '17-unify-mid')
  await sleep(3200)
  await shot(page, '18-unified')

  console.log('\n全部截图完成')
} finally {
  await browser.close()
}
