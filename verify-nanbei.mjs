/**
 * verify-nanbei.mjs —— 南北朝多行时间轴（8 页强制分页 + 动态行）
 * ---------------------------------------------------------------------------
 * 检查八页分页、每页只挂载存活行、行高拉伸、跨页裁切、易代节点弹层、帝王详情。 */
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

/** 当前页快照 */
const snapshot = (page) =>
  page.evaluate(() => {
    const stage = document.querySelector('.nbc-stage')
    const panel = document.querySelector('.nbc-page')
    const rows = [...document.querySelectorAll('.nbc-row')]
    return {
      index: panel?.getAttribute('data-page'),
      from: panel?.getAttribute('data-from'),
      to: panel?.getAttribute('data-to'),
      rowIds: rows.map((r) => r.getAttribute('data-row')),
      rowHeights: rows.map((r) => Math.round(r.getBoundingClientRect().height)),
      declaredRows: document.querySelector('.nbc-rows')?.getAttribute('data-rows'),
      emperors: document.querySelectorAll('.nbc-emp').length,
      nodes: [...document.querySelectorAll('.nbc-node')].map((n) => n.getAttribute('data-node')),
      nodeYear: document.querySelector('.nbc-node')?.getAttribute('data-year'),
      lane: Number(document.querySelector('.nbc-axis')?.getAttribute('data-lane')),
      stageW: Math.round(stage?.getBoundingClientRect().width ?? -1),
      stageScrollW: stage?.scrollWidth,
      stageClientW: stage?.clientWidth,
      cutEnd: [...document.querySelectorAll('.nbc-emp[data-cut="end"]')].map((n) => n.getAttribute('data-emp')),
      cutStart: [...document.querySelectorAll('.nbc-emp[data-cut="start"]')].map((n) => n.getAttribute('data-emp')),
      foot: document.querySelector('.nbc-foot-meta')?.textContent?.replace(/\s+/g, ' ').trim(),
      nextDisabled: document.querySelectorAll('.nbc-step button')[1]?.disabled,
      prevDisabled: document.querySelectorAll('.nbc-step button')[0]?.disabled,
    }
  })

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
  await page.waitForSelector('.nbc-page')
  await sleep(900)

  const shell = await page.evaluate(() => ({
    title: document.querySelector('.nbc-title h1')?.textContent?.trim(),
    dots: document.querySelectorAll('.nbc-dot').length,
    legendRows: [...document.querySelectorAll('.nbc-legend-row')].map((n) => n.className),
  }))
  check('标题为「南北朝」', shell.title === '南北朝', shell.title)
  check('八页分页（8 个页码点）', shell.dots === 8, String(shell.dots))

  const p1 = await snapshot(page)
  console.log('[P1]', JSON.stringify(p1))
  check('第 1 页 = 420—439', p1.from === '420' && p1.to === '439', `${p1.from}/${p1.to}`)
  check(
    '第 1 页只挂三行（十六国余部 / 北魏 / 南朝）',
    p1.rowIds.join(',') === 'can,beiwei,nan',
    p1.rowIds.join(','),
  )
  check('第 1 页行数 = data-rows', Number(p1.declaredRows) === p1.rowIds.length, p1.declaredRows)
  check('第 1 页 5 位帝王 + 节点 439', p1.emperors === 5 && p1.nodes.join(',') === 'n439', `${p1.emperors}/${p1.nodes}`)
  check('第 1 页「北魏」行有 2 位帝王', p1.emperors >= 5)
  check(
    '跨页裁切：太武帝标 data-cut=end',
    p1.cutEnd.includes('wei_taiwu'),
    p1.cutEnd.join(','),
  )
  check('第 1 页页码文案', /第 1 \/ 8 页 · 420—439 年/.test(p1.foot ?? ''), p1.foot)
  check('第一页「上一页」禁用', p1.prevDisabled === true)
  check('泳道不超出舞台', p1.lane + 96 + 64 <= p1.stageW, `${p1.lane}+160 vs ${p1.stageW}`)

  // 页面 2：439—479，只剩两行，行高应被拉开
  await page.evaluate(() => document.querySelectorAll('.nbc-dot')[1].click())
  await sleep(800)
  const p2 = await snapshot(page)
  console.log('[P2]', JSON.stringify(p2))
  check(
    '第 2 页只挂两行（北魏 / 南朝）',
    p2.rowIds.join(',') === 'beiwei,nan',
    p2.rowIds.join(','),
  )
  check(
    '动态行拉伸：两行页的行高 > 三行页',
    p2.rowHeights.every((h) => h > Math.max(...p1.rowHeights)),
    `${p2.rowHeights} vs ${p1.rowHeights}`,
  )
  check('第 2 页节点 = 479 且帝王 12 位', p2.nodes.join(',') === 'n479' && p2.emperors === 12, `${p2.nodes}/${p2.emperors}`)
  check('第 2 页孝文帝跨页裁切', p2.cutEnd.includes('wei_xiaowen'), p2.cutEnd.join(','))

  // 节点弹层
  await page.click('[data-node="n479"]')
  await sleep(500)
  const modal = await page.evaluate(() => ({
    open: Boolean(document.querySelector('.nbc-overlay')),
    title: document.querySelector('.nbc-overlay-head h2')?.textContent?.trim(),
    step: document.querySelector('.nbc-overlay-step')?.textContent?.trim(),
    lines: document.querySelectorAll('.nbc-overlay-act p').length,
  }))
  check('点击 479 节点弹出过渡页', modal.open && /刘宋灭亡/.test(modal.title ?? ''), modal.title)
  check('过渡页为多幕（第一幕 3 条）', modal.step?.includes('1 / 3') && modal.lines >= 3, `${modal.step} / ${modal.lines}`)
  await page.click('.nbc-overlay-actions .nbc-primary')
  await sleep(400)
  check(
    '可翻到第二幕',
    (await page.$eval('.nbc-overlay-step', (n) => n.textContent))?.includes('2 / 3'),
  )
  await page.click('.nbc-overlay-close')
  await sleep(400)
  check('可关闭过渡页', !(await page.$('.nbc-overlay')))

  // 帝王详情（宋武帝在第 1 页）
  await page.evaluate(() => document.querySelectorAll('.nbc-dot')[0].click())
  await sleep(800)
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

  // 滚轮翻页：按一次算一页，连续滚动被冷却吃掉
  await page.mouse.wheel({ deltaY: 130 })
  await sleep(800)
  const afterWheel = await snapshot(page)
  check('滚轮向下翻一页', afterWheel.index === '2', afterWheel.index)
  await page.mouse.wheel({ deltaY: 130 })
  await page.mouse.wheel({ deltaY: 130 })
  await page.mouse.wheel({ deltaY: 130 })
  await sleep(1000)
  const afterBurst = await snapshot(page)
  check('连续滚轮只翻一页（冷却生效）', afterBurst.index === '3', afterBurst.index)

  // 逐页扫一遍：节点齐全、行数对得上、栏宽不溢出
  const sweep = []
  for (let i = 0; i < 8; i++) {
    await page.evaluate((idx) => document.querySelectorAll('.nbc-dot')[idx].click(), i)
    await sleep(700)
    sweep.push(await snapshot(page))
  }
  console.log('[SWEEP]', JSON.stringify(sweep.map((s) => [s.index, s.from, s.to, s.rowIds.join('|'), s.emperors, s.nodes.join('')])))
  check(
    '八页窗口首尾相接：420—439—479—502—534—550—557—577—589',
    sweep.map((s) => s.from).join(',') === '420,439,479,502,534,550,557,577' &&
      sweep.map((s) => s.to).join(',') === '439,479,502,534,550,557,577,589',
  )
  check(
    '八页各收一个易代节点，合计 8 个不重复',
    new Set(sweep.flatMap((s) => s.nodes)).size === 8 && sweep.every((s) => s.nodes.length === 1),
    sweep.map((s) => s.nodes.join('')).join(','),
  )
  check(
    '每页行数与声明一致且至少 2 行',
    sweep.every((s) => Number(s.declaredRows) === s.rowIds.length && s.rowIds.length >= 2),
  )
  check(
    '第 5 页起出现东魏/西魏两行',
    sweep[4].rowIds.includes('dong') && sweep[4].rowIds.includes('xi'),
    sweep.map((s) => s.rowIds.join('|')).join(' / '),
  )
  check('末页（577—589）只剩西魏·北周与南朝', sweep[7].rowIds.join(',') === 'xi,nan', sweep[7].rowIds.join(','))
  check('末页「下一页」禁用', sweep[7].nextDisabled === true)
  check(
    '八页泳道均不超出舞台（无横向滚动）',
    sweep.every((s) => s.lane + 160 <= s.stageW && s.stageScrollW <= s.stageClientW + 1),
    sweep.map((s) => s.lane).join(','),
  )

  const overflow = await page.evaluate(() => ({
    doc: document.documentElement.scrollHeight,
    win: innerHeight,
  }))
  check('页面无纵向溢出', overflow.doc <= overflow.win + 1, JSON.stringify(overflow))

  // 换屏：1280×720 与 1920×1080 都不能溢出、泳道不能出界
  const viewports = []
  for (const [w, h] of [
    [1280, 720],
    [1920, 1080],
  ]) {
    await page.setViewport({ width: w, height: h })
    await page.evaluate(() => document.querySelectorAll('.nbc-dot')[1].click())
    await sleep(800)
    const shot = await snapshot(page)
    viewports.push({ w, ...shot })
    await page.screenshot({ path: `shots/nanbei-8p/vp-${w}x${h}.png` })
  }
  console.log('[VIEWPORTS]', JSON.stringify(viewports.map((v) => [v.w, v.lane, v.stageW, v.stageScrollW, v.stageClientW])))
  check(
    '1280×720 / 1920×1080 下泳道不出界',
    viewports.every((v) => v.lane + 160 <= v.stageW + 1 && v.stageScrollW <= v.stageClientW + 1),
    viewports.map((v) => `${v.w}:${v.lane}+160/${v.stageW},${v.stageScrollW}/${v.stageClientW}`).join(' | '),
  )
  check(
    '换屏后行高仍撑得开',
    viewports.every((v) => v.rowHeights.every((h) => h > 90)),
    viewports.map((v) => v.rowHeights.join('/')).join(' | '),
  )
  await page.setViewport({ width: 1440, height: 900 })

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


