/**
 * verify-wudai.mjs —— 五代十国并行时间轴验收
 * ===========================================================================
 * 与 verify-nanbei 同构，但只查这一朝的要点：
 *   1. 5 页窗口、每页 7—8 行（随存亡增删：闽 945 亡、楚 951 亡、北汉 951 立）；
 *   2. 中原行只有 14 位帝王卡（十国是政权带，不挂帝王卡）；
 *   3. 十国政权带的名字与起止年（前蜀→后蜀 同占一行）；
 *   4. 末页「继续下滑 · 陈桥兵变」→ 过渡页三幕 → 宋时间轴。
 */
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

const readPage = (page) =>
  page.evaluate(() => ({
    count: document.querySelector('.wdc-count')?.textContent?.trim() ?? '',
    rows: document.querySelectorAll('.wdc-row').length,
    cards: [...document.querySelectorAll('.wdc-card .emp-title')].map((n) => n.textContent?.trim()),
    bands: [...document.querySelectorAll('.wdc-polity')].map((n) => n.textContent?.trim()),
    dots: document.querySelectorAll('.wdc-dot').length,
    range: document.querySelector('.wdc-range')?.textContent?.trim() ?? '',
  }))

try {
  const page = await browser.newPage()
  await page.setCacheEnabled(false)
  page.on('pageerror', (e) => console.log('[PAGEERROR]', String(e).slice(0, 160)))

  await page.goto(`${BASE}/dynasty/five_dynasties`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.wdc-stage', { timeout: 15000 })
  await sleep(1000)

  const p1 = await readPage(page)
  console.log('[P1]', JSON.stringify(p1))
  check('五代十国 5 页', p1.dots === 5 && p1.count.includes('1 / 5'), p1.count)
  check('页 1 有 7 行（荆南 924、北汉 951 未登场）', p1.rows === 7, String(p1.rows))
  check('页 1 中原行 3 位帝王卡', p1.cards.join(',') === '后梁太祖,后梁郢王,后梁末帝', p1.cards.join(','))
  check('页 1 十国政权带', p1.bands.some((b) => b.startsWith('吴')) && p1.bands.some((b) => b.startsWith('前蜀')), p1.bands.join(' | '))

  const goPage = async (n) => {
    await page.click(`[aria-label="第 ${n} 页"]`)
    await sleep(850)
    return readPage(page)
  }

  const p2 = await goPage(2)
  console.log('[P2]', JSON.stringify(p2))
  check('页 2 有 8 行（荆南 924 登场）', p2.rows === 8, String(p2.rows))
  check('页 2 中原行 4 位帝王卡', p2.cards.join(',') === '后唐庄宗,后唐明宗,后唐闵帝,后唐末帝', p2.cards.join(','))
  check('页 2 前蜀与后蜀同占一行', p2.bands.some((b) => b.startsWith('前蜀')) && p2.bands.some((b) => b.startsWith('后蜀')), p2.bands.join(' | '))

  const p3 = await goPage(3)
  check('页 3 有 8 行（闽 945 亡前仍在）', p3.rows === 8, String(p3.rows))

  const p4 = await goPage(4)
  check('页 4 有 7 行（闽已亡、北汉未立）', p4.rows === 7, String(p4.rows))

  const p5 = await goPage(5)
  console.log('[P5]', JSON.stringify(p5))
  check('页 5 有 7 行（北汉 951 立）', p5.rows === 7, String(p5.rows))
  check('页 5 中原行为后周三帝', p5.cards.join(',') === '后周太祖,后周世宗,后周恭帝', p5.cards.join(','))
  const fallBtn = await page.$('.wdc-btn--fall')
  check('末页出现「继续下滑 · 陈桥兵变」', Boolean(fallBtn))

  await page.click('.wdc-btn--fall')
  await page.waitForSelector('.fall-page', { timeout: 12000 })
  await sleep(900)
  const fall = await page.evaluate(() => ({
    title: document.querySelector('.fall-brand-title')?.textContent?.trim(),
    dots: document.querySelectorAll('.fall-dot').length,
    img: document.querySelectorAll('.fall-photo').length,
  }))
  console.log('[FALL]', JSON.stringify(fall))
  check('过渡页「陈桥兵变」三幕', fall.dots === 3, JSON.stringify(fall))
  check('过渡页已配器物图', fall.img === 1, String(fall.img))

  for (let i = 0; i < 2; i += 1) {
    await page.mouse.move(700, 450)
    await page.mouse.wheel({ deltaY: 220 })
    await sleep(750)
  }
  await page.mouse.click(720, 460)
  await sleep(700)
  await page.click('.fall-enter')
  await sleep(2400)
  check('五代出口 → 宋统一沙盘', /\/dynasty\/five_dynasties\/endgame$/.test(page.url()), page.url())

  await browser.close()
} catch (err) {
  console.error(err)
  await browser.close()
  process.exitCode = 1
}
const failed = results.filter((r) => !r.pass)
console.log(`\n===== ${results.length - failed.length}/${results.length} passed =====`)
if (failed.length) process.exitCode = 1
