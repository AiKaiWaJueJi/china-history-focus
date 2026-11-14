/**
 * verify-nanbei.mjs —— 南北朝多行时间轴
 * ---------------------------------------------------------------------------
 * 检查四行并行、帝王卡数量、横向年份轴、七个易代节点弹层、帝王详情。
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

try {
  const page = await browser.newPage()
  await page.setCacheEnabled(false)
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 160))
  })

  await page.goto(`${BASE}/dynasty/southern_northern`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.nanbei')
  await sleep(900)

  const shell = await page.evaluate(() => ({
    title: document.querySelector('.nbc-title h1')?.textContent?.trim(),
    rows: document.querySelectorAll('.nbc-row').length,
    polities: document.querySelectorAll('.nbc-polity').length,
    emperors: document.querySelectorAll('.nbc-emp').length,
    nodes: document.querySelectorAll('.nbc-node').length,
    labels: [...document.querySelectorAll('.nbc-rowlabel b')].map((n) => n.textContent?.trim()),
    scrollW: document.querySelector('.nbc-scroll')?.scrollWidth,
    clientW: document.querySelector('.nbc-scroll')?.clientWidth,
  }))
  console.log('[SHELL]', JSON.stringify(shell))
  check('标题为「南北朝」', shell.title === '南北朝', shell.title)
  check('四行并行（北魏 / 东魏·北齐 / 西魏·北周 / 南朝）', shell.rows === 4 && shell.labels.join(',') === '北魏,东魏·北齐,西魏·北周,南朝', shell.labels.join(','))
  check('9 个政权块、54 位帝王、7 个易代节点', shell.polities === 9 && shell.emperors === 54 && shell.nodes === 7, `${shell.polities}/${shell.emperors}/${shell.nodes}`)
  check('横向时间轴可滚动（420—589 超出视口）', shell.scrollW > shell.clientW + 400, `${shell.scrollW}/${shell.clientW}`)

  const axis = await page.evaluate(() => ({
    first: document.querySelector('.nbc-tick')?.textContent?.trim(),
    last: [...document.querySelectorAll('.nbc-tick')].at(-1)?.textContent?.trim(),
    years: [...document.querySelectorAll('.nbc-node')].map((n) => n.getAttribute('data-year')),
  }))
  check('年份轴从 420 到 589', axis.first === '420' && axis.last === '589', `${axis.first}/${axis.last}`)
  check('节点年份为 479/502/534/550/557/577/589', axis.years.join(',') === '479,502,534,550,557,577,589', axis.years.join(','))

  await page.click('[data-node="n479"]')
  await sleep(500)
  const modal = await page.evaluate(() => ({
    open: Boolean(document.querySelector('.nbc-overlay')),
    title: document.querySelector('.nbc-overlay-head h2')?.textContent?.trim(),
    step: document.querySelector('.nbc-overlay-step')?.textContent?.trim(),
    lines: document.querySelectorAll('.nbc-overlay-act p').length,
  }))
  console.log('[MODAL]', JSON.stringify(modal))
  check('点击 479 节点弹出过渡页', modal.open && /刘宋灭亡/.test(modal.title ?? ''), modal.title)
  check('过渡页为多幕（第一幕 3 条）', modal.step?.includes('1 / 3') && modal.lines >= 3, `${modal.step} / ${modal.lines}`)

  await page.click('.nbc-overlay-actions .nbc-primary')
  await sleep(400)
  check('可翻到第二幕', (await page.$eval('.nbc-overlay-step', (n) => n.textContent))?.includes('2 / 3'))
  await page.click('.nbc-overlay-close')
  await sleep(400)
  check('可关闭过渡页', !(await page.$('.nbc-overlay')))

  await page.click('[data-emp="song_wu"]')
  await sleep(400)
  const detail = await page.evaluate(() => ({
    open: Boolean(document.querySelector('.nbc-detail')),
    title: document.querySelector('.nbc-detail h2')?.textContent?.trim(),
    name: document.querySelector('.nbc-detail p')?.textContent?.trim(),
  }))
  check('点击宋武帝弹出帝王详情', detail.open && detail.title === '宋武帝' && detail.name === '刘裕', JSON.stringify(detail))
  await page.keyboard.press('Escape')
  await sleep(300)
  check('ESC 关闭帝王详情', !(await page.$('.nbc-detail')))

  const overflow = await page.evaluate(() => ({
    doc: document.documentElement.scrollHeight,
    win: innerHeight,
  }))
  check('页面无纵向溢出', overflow.doc <= overflow.win + 1, JSON.stringify(overflow))

  check('无控制台错误', errors.length === 0, errors.join(' | '))

  await browser.close()
} catch (err) {
  console.error(err)
  await browser.close()
  process.exitCode = 1
}
const failed = results.filter((r) => !r.pass)
console.log(`\n===== ${results.length - failed.length}/${results.length} passed =====`)
if (failed.length) process.exitCode = 1
