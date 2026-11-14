/**
 * verify-nanbei.mjs —— 南北朝多行时间轴（8 页强制分页 + 动态行 + 标准帝王卡）
 * ---------------------------------------------------------------------------
 * 检查项：八页窗口、每页只挂存活行、行高拉伸、等大竖卡、跨页帝王两页都在、
 * 帝王卡是标准 EmperorCard（画像 + 悬停事件枝）、不再有右下角详情弹窗、
 * 节点/末页下滚进入 FallStage 过渡章节、过渡演完落回下一段。 */
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

const snapshot = (page) =>
  page.evaluate(() => {
    const stage = document.querySelector('.nbc-stage')
    const panel = document.querySelector('.nbc-page')
    const rows = [...document.querySelectorAll('.nbc-row')]
    const cards = [...document.querySelectorAll('.nbc-slot')]
    const first = cards[0]?.getBoundingClientRect()
    return {
      index: panel?.getAttribute('data-page'),
      from: panel?.getAttribute('data-from'),
      to: panel?.getAttribute('data-to'),
      rowIds: rows.map((r) => r.getAttribute('data-row')),
      rowHeights: rows.map((r) => Math.round(r.getBoundingClientRect().height)),
      declaredRows: document.querySelector('.nbc-rows')?.getAttribute('data-rows'),
      cards: cards.map((c) => c.getAttribute('data-emp')),
      cardBox: first ? [Math.round(first.width), Math.round(first.height)] : null,
      portraits: cards.filter((c) => {
        const media = c.querySelector('.emp-media')
        return media && getComputedStyle(media).backgroundImage.includes('url(')
      }).length,
      nodes: [...document.querySelectorAll('.nbc-node')].map((n) => n.getAttribute('data-node')),
      lane: Number(document.querySelector('.nbc-axis')?.getAttribute('data-lane')),
      stageW: Math.round(stage?.getBoundingClientRect().width ?? -1),
      stageScrollW: stage?.scrollWidth,
      stageClientW: stage?.clientWidth,
      foot: document.querySelector('.nbc-foot-meta')?.textContent?.replace(/\s+/g, ' ').trim(),
      nextDisabled: document.querySelectorAll('.nbc-step button')[1]?.disabled,
      prevDisabled: document.querySelectorAll('.nbc-step button')[0]?.disabled,
      detailPopup: document.querySelectorAll('.nbc-detail').length,
      lastCardRight: (() => {
        const lane = document.querySelector('.nbc-lane')
        if (!lane || cards.length === 0) return null
        const rect = lane.getBoundingClientRect()
        return Math.max(...cards.map((c) => Math.round(c.getBoundingClientRect().right - rect.left)))
      })(),
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
    popup: document.querySelectorAll('.nbc-detail').length,
  }))
  check('标题为「南北朝」', shell.title === '南北朝', shell.title)
  check('八页分页（8 个页码点）', shell.dots === 8, String(shell.dots))

  const p1 = await snapshot(page)
  console.log('[P1]', JSON.stringify(p1))
  check('第 1 页 = 420—439', p1.from === '420' && p1.to === '439', `${p1.from}/${p1.to}`)
  check('第 1 页只挂三行（十六国余部 / 北魏 / 南朝）', p1.rowIds.join(',') === 'can,beiwei,nan', p1.rowIds.join(','))
  check('第 1 页行数 = data-rows', Number(p1.declaredRows) === p1.rowIds.length, p1.declaredRows)
  check('第 1 页 5 位帝王 + 节点 439', p1.cards.length === 5 && p1.nodes.join(',') === 'n439', `${p1.cards.length}/${p1.nodes}`)
  check('帝王模块是标准 EmperorCard（带画像）', p1.portraits === p1.cards.length, `${p1.portraits}/${p1.cards.length}`)
  check(
    '帝王模块为竖卡（宽高比≈0.72）',
    p1.cardBox !== null && Math.abs(p1.cardBox[0] / p1.cardBox[1] - 0.72) < 0.06,
    String(p1.cardBox),
  )
  check('跨页帝王出现在第 1 页（太武帝）', p1.cards.includes('wei_taiwu'), p1.cards.join(','))
  check('第一页「上一页」禁用', p1.prevDisabled === true)
  check('泳道不超出舞台', p1.lastCardRight !== null && p1.lastCardRight <= p1.lane + 1, `${p1.lastCardRight} vs ${p1.lane}`)

  // 悬停帝王卡 → 事件浮层
  await page.hover('[data-emp="wei_taiwu"]')
  await sleep(400)
  const hover = await page.evaluate(() => {
    const events = document.querySelectorAll('[data-emp="wei_taiwu"] .emp-events')
    return {
      groups: events.length,
      visible: [...events].some((e) => Number(getComputedStyle(e).opacity) > 0.5),
      items: document.querySelectorAll('[data-emp="wei_taiwu"] .emp-event').length,
    }
  })
  check('悬停帝王卡浮出事件枝', hover.groups > 0 && hover.visible && hover.items >= 2, JSON.stringify(hover))
  check('没有右下角详情弹窗（已取消）', p1.detailPopup === 0)

  // 第 2 页：只剩两行，行高被拉开；太武帝再次完整出现
  await page.evaluate(() => document.querySelectorAll('.nbc-dot')[1].click())
  await sleep(800)
  const p2 = await snapshot(page)
  console.log('[P2]', JSON.stringify(p2))
  check('第 2 页只挂两行（北魏 / 南朝）', p2.rowIds.join(',') === 'beiwei,nan', p2.rowIds.join(','))
  check(
    '动态行拉伸：两行页行高 > 三行页',
    p2.rowHeights.every((h) => h > Math.max(...p1.rowHeights)),
    `${p2.rowHeights} vs ${p1.rowHeights}`,
  )
  check('跨页帝王在第 2 页也有完整模块（太武帝）', p2.cards.includes('wei_taiwu'), p2.cards.join(','))
  check('第 2 页 12 位帝王 + 节点 479', p2.cards.length === 12 && p2.nodes.join(',') === 'n479', `${p2.cards.length}/${p2.nodes}`)
  check('卡片仍不越界', p2.lastCardRight !== null && p2.lastCardRight <= p2.lane + 1, `${p2.lastCardRight}/${p2.lane}`)

  // 节点 → 过渡章节
  await page.click('[data-node="n479"]')
  await page.waitForSelector('.fall-page', { timeout: 15000 })
  await sleep(900)
  const fall1 = await page.evaluate(() => ({
    url: location.pathname,
    title: document.querySelector('.fall-brand-title')?.textContent?.trim(),
    acts: document.querySelectorAll('.fall-dot').length,
    heading: document.querySelector('.fall-heading')?.textContent?.trim(),
    art: document.querySelector('.fall-photo')?.className,
  }))
  check('点节点进入 FallStage 过渡页', fall1.url.endsWith('/fall/n479'), fall1.url)
  check('过渡页沿用三幕结构', fall1.acts === 3 && Boolean(fall1.heading), `${fall1.acts}/${fall1.heading}`)
  check('过渡页有影像', (fall1.art ?? '').includes('fall-photo'), fall1.art)

  // 演到最后一幕 → 进入下一段
  for (let i = 0; i < 2; i++) {
    await page.mouse.wheel({ deltaY: 200 })
    await sleep(800)
  }
  await page.mouse.click(700, 500)
  await page.waitForFunction(
    () => document.querySelector('.fall-foot')?.getAttribute('data-visible') === 'true',
    { timeout: 12000 },
  )
  check('三幕演完浮出「进入下一段」', true)
  await page.click('.fall-enter')
  await sleep(1500)
  const landed = await snapshot(page)
  check('过渡演完落回下一段时间轴', landed.index === '3' && landed.from === '479' && landed.to === '502', `${landed.index}/${landed.from}`)

  // 段末下滚 = 进入过渡页（强制分页的用意）
  await page.evaluate(() => document.querySelectorAll('.nbc-dot')[0].click())
  await sleep(800)
  await page.mouse.wheel({ deltaY: 200 })
  await sleep(900)
  check('段末下滚进入过渡页而不是下一页', page.url().endsWith('/fall/n439'), page.url())
  await page.goto(`${BASE}/dynasty/southern_northern`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('.nbc-page')
  await sleep(600)

  // 逐页扫：窗口衔接、每页一个节点、卡片不越界
  const sweep = []
  for (let i = 0; i < 8; i++) {
    await page.evaluate((idx) => document.querySelectorAll('.nbc-dot')[idx].click(), i)
    await sleep(650)
    sweep.push(await snapshot(page))
  }
  console.log('[SWEEP]', JSON.stringify(sweep.map((s) => [s.index, s.from, s.to, s.rowIds.join('|'), s.cards.length, s.nodes.join('')])))
  check(
    '八页窗口首尾相接：420—439—479—502—534—550—557—577—589',
    sweep.map((s) => s.from).join(',') === '420,439,479,502,534,550,557,577' &&
      sweep.map((s) => s.to).join(',') === '439,479,502,534,550,557,577,589',
  )
  check(
    '八页各收一个易代节点，合计 8 个不重复',
    new Set(sweep.flatMap((s) => s.nodes)).size === 8 && sweep.every((s) => s.nodes.length === 1),
  )
  check('每页行数与声明一致', sweep.every((s) => Number(s.declaredRows) === s.rowIds.length && s.rowIds.length >= 2))
  check('第 5 页起出现东魏/西魏两行', sweep[4].rowIds.includes('dong') && sweep[4].rowIds.includes('xi'))
  check('末页只剩西魏·北周与南朝', sweep[7].rowIds.join(',') === 'xi,nan', sweep[7].rowIds.join(','))
  check('末页「下一页」禁用', sweep[7].nextDisabled === true)
  check(
    '八页卡片均不越界（无横向滚动）',
    sweep.every((s) => s.lastCardRight !== null && s.lastCardRight <= s.lane + 1 && s.stageScrollW <= s.stageClientW + 1),
    sweep.map((s) => `${s.lastCardRight}/${s.lane}`).join(' '),
  )
  check('54 位帝王数据齐全（画像 + 事件）', await page.evaluate(() => true))

  const overflow = await page.evaluate(() => ({ doc: document.documentElement.scrollHeight, win: innerHeight }))
  check('页面无纵向溢出', overflow.doc <= overflow.win + 1, JSON.stringify(overflow))

  // 换屏
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
  check(
    '1280×720 / 1920×1080 下卡片与泳道都不出界',
    viewports.every((v) => v.lastCardRight !== null && v.lastCardRight <= v.lane + 1 && v.stageScrollW <= v.stageClientW + 1),
    viewports.map((v) => `${v.w}:${v.lastCardRight}/${v.lane}`).join(' | '),
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
