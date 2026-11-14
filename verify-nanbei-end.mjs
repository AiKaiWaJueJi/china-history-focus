/**
 * verify-nanbei-end.mjs —— 南北朝收尾沙盘（隋灭陈）
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
const state = () => ({
  title: document.querySelector('.jc-title h1')?.textContent?.trim(),
  year: document.querySelector('.jc-stepno span')?.textContent?.trim(),
  regions: Object.fromEntries([...document.querySelectorAll('.jc-region')].map((n) => [n.dataset.region, n.dataset.regime])),
  chips: [...document.querySelectorAll('.jc-chip')].map((n) => n.textContent?.trim()),
})

try {
  const page = await browser.newPage()
  await page.setCacheEnabled(false)
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)))

  await page.goto(`${BASE}/dynasty/southern_northern/endgame`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.jin-chronicle')
  await sleep(900)

  const first = await page.evaluate(state)
  console.log('[576]', JSON.stringify(first.regions))
  check('收尾沙盘标题为「南北朝收尾 · 隋灭陈」', first.title === '南北朝收尾 · 隋灭陈', first.title)
  check('九块区域、五幕（576 开局）', Object.keys(first.regions).length === 9 && first.year === '576年', `${Object.keys(first.regions).length}/${first.year}`)
  check(
    '576 年：关中/巴蜀属北周，河北/中原/山东属北齐，江南属陈',
    first.regions.guanzhong === 'beizhou' &&
      first.regions.bashu === 'beizhou' &&
      first.regions.hebei === 'beiqi' &&
      first.regions.jiangnan === 'chen',
    JSON.stringify(first.regions),
  )

  await page.click('.jc-node[data-step="1"]')
  await sleep(700)
  const p577 = await page.evaluate(state)
  check(
    '577 年：北周灭北齐，取河北、中原、山东',
    p577.regions.hebei === 'beizhou' && p577.regions.zhongyuan === 'beizhou' && p577.regions.shandong === 'beizhou',
    JSON.stringify(p577.regions),
  )

  await page.click('.jc-node[data-step="4"]')
  await sleep(700)
  const last = await page.evaluate(state)
  check('589 年：九块尽归隋', Object.values(last.regions).every((r) => r === 'sui') && last.chips.some((c) => c?.startsWith('隋')), JSON.stringify(last.chips))
  const label = await page.$eval('.jc-actions .jc-primary', (n) => n.textContent?.trim())
  check('末幕按钮为「推演结束 · 回时间轴」', label === '推演结束 · 回时间轴', label)

  await page.click('.jc-actions .jc-primary')
  await sleep(800)
  check('推演结束回到南北朝时间轴', page.url().endsWith('/dynasty/southern_northern'), page.url())
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
