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
  /* ---- 十国：政权带 → 政权档案 → 君主档案（批次 7 新增） ---- */
  await goPage(1)
  await sleep(400)
  const bandBefore = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.wdc-polity')].find((x) => x.getAttribute('aria-label')?.startsWith('吴 '))
    return { found: Boolean(b), label: b?.getAttribute('aria-label') ?? '', role: b?.getAttribute('role') ?? '' }
  })
  check('十国政权带可点（role=button 且有可读标签）', bandBefore.found && bandBefore.role === 'button', bandBefore.label)

  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.wdc-polity')].find((x) => x.getAttribute('aria-label')?.startsWith('吴 '))
    b.click()
  })
  await sleep(700)
  const regime = await page.evaluate(() => ({
    open: Boolean(document.querySelector('.codex-drawer')),
    kind: document.querySelector('.codex-drawer .codex-kind')?.textContent?.trim() ?? '',
    name: document.querySelector('.codex-drawer .codex-name')?.textContent?.trim() ?? '',
    rulers: [...document.querySelectorAll('.codex-drawer .codex-link')].map((n) => n.textContent.trim()),
  }))
  check('点政权带打开政权档案', regime.open && regime.kind === '政权' && regime.name === '吴', `${regime.kind}/${regime.name}`)
  check('政权档案里列出本国君主', regime.rulers.includes('吴太祖') && regime.rulers.length >= 4, regime.rulers.slice(0, 5).join(','))

  /* 点君主 → 下钻到君主档案（结构化时间线） */
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.codex-drawer .codex-link')].find((n) => n.textContent.trim() === '吴太祖')
    b.click()
  })
  await sleep(700)
  const ruler = await page.evaluate(() => ({
    kind: document.querySelector('.codex-drawer .codex-kind')?.textContent?.trim() ?? '',
    name: document.querySelector('.codex-drawer .codex-name')?.textContent?.trim() ?? '',
    reign: document.querySelector('.codex-archive-reign')?.textContent?.trim() ?? '',
    hasEvents: document.querySelectorAll('.codex-drawer .codex-event').length > 0,
  }))
  check('点君主下钻到君主档案', ruler.kind === '君主' && ruler.name === '吴太祖', `${ruler.kind}/${ruler.name}`)
  check('君主档案有结构化在位要事', ruler.hasEvents, ruler.reign)

  await page.keyboard.press('Escape')
  await sleep(500)
  /* 回末页，接上原有的「陈桥兵变」出口检查 */
  await goPage(5)
  await sleep(500)

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
