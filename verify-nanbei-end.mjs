/**
 * verify-nanbei-end.mjs —— 南北朝收尾沙盘（大一统模板）
 * 577 周灭齐（战报两页：周灭齐 / 隋代周）→ 588 渡江 → 589 灭陈
 */
import puppeteer from 'puppeteer-core'
import { clickRailNode } from './scripts/lib/verify-rail.mjs'

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

  await page.goto(`${BASE}/dynasty/southern_northern/endgame`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.map-stage')
  await sleep(900)

  const shell = await page.evaluate(() => ({
    title: document.querySelector('.endgame-title')?.textContent?.trim(),
    regions: [...document.querySelectorAll('.region')].map((n) => n.dataset.nation),
    neutralPE: document.querySelector('.region.is-neutral') ? getComputedStyle(document.querySelector('.region.is-neutral')).pointerEvents : 'missing',
    rails: [...document.querySelectorAll('.rail-node')].map((n) => n.innerText.trim()),
  }))
  console.log('[SHELL]', JSON.stringify(shell))
  // 第三轮换底板后多了两块背景势力（西域·高原诸部 / 爨氏·西南夷）
  check(
    '标准大一统沙盘：周/齐/陈/突厥 + 2 背景势力',
    ['beizhou', 'qi', 'chen', 'tujue'].every((id) => shell.regions.includes(id)) && shell.regions.length === 6,
    shell.regions.join(','),
  )
  check('突厥不可点击（pointer-events:none）', shell.neutralPE === 'none', shell.neutralPE)
  check('底部无「北周/隋」重复容器，且陈只出现一次', shell.rails.join('|').includes('北齐') && shell.rails.filter((x) => x.includes('陈')).length === 1, shell.rails.join(' / '))
  const defaultNote = await page.evaluate(() => ({
    empireName: document.querySelectorAll('.map-empire-name').length,
    usurp: document.querySelectorAll('.map-usurp-note').length,
    qin: document.querySelector('.region-label--qin')?.textContent?.trim(),
  }))
  check('默认状态没有居中「隋」大字', defaultNote.empireName === 0, JSON.stringify(defaultNote))
  check('默认状态没有易代提示浮标，攻方仍为北周', defaultNote.usurp === 0 && defaultNote.qin === '北周', JSON.stringify(defaultNote))

  await clickRailNode(page, 1, sleep)
  await sleep(500)
  const report1 = await page.evaluate(() => ({
    panel: Boolean(document.querySelector('.battle-panel')),
    title: document.querySelector('.battle-title')?.textContent?.trim(),
    pager: Boolean(document.querySelector('.battle-pager')),
    next: [...document.querySelectorAll('.battle-page-btn')].map((n) => n.textContent?.trim()),
  }))
  check('点击北齐打开「周灭北齐」战报', report1.panel && report1.title === '周灭北齐', report1.title)
  check('战报内有第二页按钮', report1.pager && report1.next.some((t) => t?.includes('隋代周')), report1.next.join(' / '))
  const page577 = await page.evaluate(() => ({
    qin: document.querySelector('.region-label--qin')?.textContent?.trim(),
    usurp: document.querySelectorAll('.map-usurp-note').length,
  }))
  check('577 页攻方仍是北周、无易代提示', page577.qin === '北周' && page577.usurp === 0, JSON.stringify(page577))

  await page.click('.battle-page-btn--primary')
  await sleep(500)
  const report2 = await page.evaluate(() => ({
    title: document.querySelector('.battle-title')?.textContent?.trim(),
    back: [...document.querySelectorAll('.battle-page-btn')].map((n) => n.textContent?.trim()),
  }))
  check('第二页为「隋代北周」', report2.title === '隋代北周', report2.title)
  check('第二页有返回按钮', report2.back.some((t) => t?.includes('返回上一战报')), report2.back.join(' / '))
  const page581 = await page.evaluate(() => ({
    qin: document.querySelector('.region-label--qin')?.textContent?.trim(),
    note: document.querySelector('.map-usurp-note')?.textContent?.replace(/\s+/g, '') ?? null,
    ring: document.querySelector('.map-stage')?.getAttribute('data-usurp'),
  }))
  check('581 页攻方显示为隋', page581.qin === '隋', page581.qin)
  check(
    '581 页在隋疆域内浮出「杨坚称帝·改国号隋」',
    page581.note?.includes('杨坚称帝') && page581.ring === 'true',
    JSON.stringify(page581),
  )
  await page.screenshot({ path: 'shots/sui/verify-581.png' })

  await page.click('.battle-page-btn:not(.battle-page-btn--primary)')
  await sleep(400)
  check('返回按钮可回到第一页', (await page.$eval('.battle-title', (n) => n.textContent?.trim())) === '周灭北齐')
  await page.click('.battle-close')
  await sleep(700)

  const closed = await page.evaluate(() => ({
    usurp: document.querySelectorAll('.map-usurp-note').length,
    qin: document.querySelector('.region-label--qin')?.textContent?.trim(),
  }))
  check('关闭战报后易代提示消失、攻方回到北周', closed.usurp === 0 && closed.qin === '北周', JSON.stringify(closed))
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
