/**
 * verify-frame.mjs —— 后续七朝（隋 / 唐 / 五代 / 宋 / 元 / 明 / 清）骨架验收
 * ===========================================================================
 * 这一轮只做「大致框架」：
 *   帝王时间轴可翻页 → 末页进收尾过渡 → 过渡演完直接进下一朝时间轴。
 * 因此断言集中在三处：
 *   1. 帝数 / 页数（按分段切页的算法在脚本里重算一遍，不信组件自报）；
 *   2. 每朝首页帝王与画像路径（首页帝数随分段长度变化，不是固定 3 个）；
 *   3. 末页入口文案 + 过渡页三幕 + 出口指向下一朝（清 → 回主页）。
 */
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'node:fs'

const BASE = process.env.APP_URL ?? 'http://localhost:5180'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PAGE_SIZE = 3

const DYNASTIES = [
  { id: 'sui', label: '隋亡', first: ['隋文帝'], next: '/dynasty/tang' },
  { id: 'tang', label: '朱温篡唐', first: ['唐高祖', '唐太宗', '唐高宗'], next: '/dynasty/five_dynasties' },
  { id: 'song', label: '宋亡', first: ['宋太祖', '宋太宗', '宋真宗'], next: '/dynasty/yuan' },
  { id: 'yuan', label: '红巾北伐', first: ['元世祖'], next: '/dynasty/ming' },
  { id: 'ming', label: '明亡', first: ['明太祖'], next: '/dynasty/qing' },
  { id: 'qing', label: '清亡', first: ['清太祖', '清太宗'], next: '/' },
]

/** 照 DynastyDetail.pages 的规则重算页数：先按 segmentId 分组，组内每 3 人一页 */
function expectedPages(id) {
  const file = JSON.parse(readFileSync(new URL(`./src/data/emperors.${id}.json`, import.meta.url), 'utf8'))
  const pages = []
  let group = []
  let seg
  const flush = () => {
    for (let i = 0; i < group.length; i += PAGE_SIZE) pages.push(group.slice(i, i + PAGE_SIZE))
    group = []
  }
  for (const e of file.emperors) {
    if (seg !== undefined && e.segmentId !== seg) flush()
    seg = e.segmentId
    group.push(e)
  }
  flush()
  return { pages, total: file.emperors.length }
}

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

const readShell = (page) =>
  page.evaluate(() => ({
    count: document.querySelector('.timeline-count')?.textContent?.trim() ?? '',
    dots: document.querySelectorAll('.timeline-dot').length,
    bands: document.querySelectorAll('.seg-band').length,
    titles: [...document.querySelectorAll('.emp-title')].map((n) => n.textContent?.trim()),
    portraits: [...document.querySelectorAll('.emp-card')].map((n) => getComputedStyle(n).getPropertyValue('--portrait')),
    button: document.querySelector('.timeline-btn--endgame')?.textContent?.trim() ?? null,
  }))

try {
  const page = await browser.newPage()
  await page.setCacheEnabled(false)
  page.on('pageerror', (e) => console.log('[PAGEERROR]', String(e).slice(0, 160)))

  for (const d of DYNASTIES) {
    const { pages, total } = expectedPages(d.id)
    await page.goto(`${BASE}/dynasty/${d.id}`, { waitUntil: 'networkidle2', timeout: 60000 })
    await page.waitForSelector('.pager', { timeout: 15000 })
    await sleep(900)

    const shell = await readShell(page)
    check(
      `${d.id} 帝王 ${total} 位 / ${pages.length} 页`,
      shell.count.includes(`${total}`) && shell.count.includes(`/ ${pages.length}`),
      shell.count,
    )
    check(`${d.id} 页码点 ${pages.length} 个`, shell.dots === pages.length, String(shell.dots))
    check(`${d.id} 分段轴色带数`, shell.bands > 0, String(shell.bands))
    check(`${d.id} 首页帝王`, shell.titles.join(',') === d.first.join(','), shell.titles.join(','))
    check(
      `${d.id} 画像为程序化占位 SVG`,
      shell.portraits.every((p) => p.includes('/portraits/') && p.includes('.svg')),
      shell.portraits.join(' | '),
    )

    // 末页：入口文案（先切页 → 等过 800ms 防抖 → 再点）
    await page.click(`[aria-label="第 ${pages.length} 页"]`)
    await sleep(1200)
    const last = await readShell(page)
    check(`${d.id} 末页入口「${d.label}」`, (last.button ?? '').includes(d.label), last.button)
    check(
      `${d.id} 末页帝王`,
      last.titles.join(',') === pages[pages.length - 1].map((e) => e.posthumousTitle).join(','),
      last.titles.join(','),
    )

    await page.click('.timeline-btn--endgame')
    await page.waitForSelector('.fall-page', { timeout: 12000 })
    await sleep(900)
    const fall = await page.evaluate(() => ({
      title: document.querySelector('.fall-brand-title')?.textContent?.trim(),
      dots: document.querySelectorAll('.fall-dot').length,
      acts: document.querySelectorAll('.fall-act').length,
    }))
    check(`${d.id} 过渡页「${d.label}」三幕`, fall.dots === 3, JSON.stringify(fall))

    // 走完三幕 → 进下一朝（清回主页）
    for (let i = 0; i < 2; i += 1) {
      await page.mouse.move(700, 450)
      await page.mouse.wheel({ deltaY: 220 })
      await sleep(750)
    }
    await page.mouse.click(720, 460)
    await sleep(700)
    await page.click('.fall-enter')
    await sleep(2400)
    const url = page.url()
    check(`${d.id} 过渡页出口 → 本朝沙盘`, url.endsWith(`/dynasty/${d.id}/endgame`), url)
    await page.waitForSelector('.qin-entry, .endgame-stage, svg', { timeout: 12000 })
    await sleep(800)
    const eg = await page.evaluate(() => ({
      shapes: document.querySelectorAll('polygon, path').length,
      text: document.body.innerText.slice(0, 80).replace(/\s+/g, ' '),
    }))
    check(`${d.id} 沙盘已渲染`, eg.shapes > 3, String(eg.shapes))

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
