/**
 * verify-jin-sandbox.mjs —— 晋末「十六国 · 南北分合」势力沙盘
 * ---------------------------------------------------------------------------
 * 这不是灭国战，检查的是：区域数、逐幕势力归属、关键年份（316/352/376/398/420）
 * 是否与史料口径一致，以及时间轴末页能否进入、返回。
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

const state = () =>
  document.querySelector('.jin-chronicle') && {
    year: document.querySelector('.jc-stepno span')?.textContent?.trim(),
    title: document.querySelector('.jc-panel h2')?.textContent?.trim(),
    regions: Object.fromEntries(
      [...document.querySelectorAll('.jc-region')].map((n) => [n.dataset.region, n.dataset.regime]),
    ),
    chips: [...document.querySelectorAll('.jc-chip')].map((n) => n.textContent?.trim()),
    nodes: document.querySelectorAll('.jc-node').length,
    routes: document.querySelectorAll('.jc-route').length,
  }

try {
  const page = await browser.newPage()
  await page.setCacheEnabled(false)
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 160))
  })

  await page.goto(`${BASE}/dynasty/jin/endgame`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.jin-chronicle')
  await sleep(900)

  const first = await page.evaluate(state)
  console.log('[316]', JSON.stringify(first.regions))
  const fit = await page.evaluate(() => ({ overflow: document.documentElement.scrollHeight - innerHeight, svgBottom: document.querySelector('.jc-map svg').getBoundingClientRect().bottom, win: innerHeight }))
  check('地图不超出视口（无纵向溢出）', fit.overflow <= 1 && fit.svgBottom <= fit.win + 1, JSON.stringify(fit))

  check('沙盘标题为「十六国 · 南北分合」', (await page.$eval('.jc-title h1', (n) => n.textContent)) === '十六国 · 南北分合')
  check('14 个区域 + 13 幕', first.nodes === 13 && Object.keys(first.regions).length === 14, `${first.nodes}/${Object.keys(first.regions).length}`)
  check(
    '316 年：关中属汉赵、河北属石勒、江南属东晋、巴蜀属成汉',
    first.regions.guanzhong === 'hanzhao' &&
      first.regions.hebei === 'houzhao' &&
      first.regions.jiangnan === 'dongjin' &&
      first.regions.bashu === 'chenghan' &&
      first.regions.lingnan === 'dongjin',
    JSON.stringify(first.regions),
  )

  /*
    山河参照层（2026-11-24）：不只验「画出来了」，更要验「画在版图之上」。
    首版把河道放在 regions 之前渲染，被 fillOpacity 0.7 的色块压得几乎看不见——
    这种问题只有肉眼能发现，所以补一条 DOM 顺序断言守住。
  */
  const rivers = await page.evaluate(() => {
    const layer = document.querySelector('.jc-rivers')
    const firstRegion = document.querySelector('.jc-region')
    const all = [...document.querySelectorAll('.jc-river')]
    return {
      count: all.length,
      names: [...document.querySelectorAll('.jc-river-name')].map((n) => n.textContent?.trim()),
      aboveRegions: Boolean(
        layer && firstRegion && layer.compareDocumentPosition(firstRegion) & Node.DOCUMENT_POSITION_PRECEDING,
      ),
    }
  })
  console.log('[RIVERS]', JSON.stringify(rivers))
  check(
    '山河参照层画出黄河/长江/淮河三条',
    rivers.count === 3 && ['黄河', '长江', '淮河'].every((n) => rivers.names.includes(n)),
    `${rivers.count} 条：${rivers.names.join('/')}`,
  )
  check('河道压在版图色块之上（不是被盖住的底层）', rivers.aboveRegions, String(rivers.aboveRegions))

  const jump = async (i) => {
    await page.click(`.jc-node[data-step="${i}"]`)
    await sleep(650)
    return page.evaluate(state)
  }

  const p352 = await jump(5)
  console.log('[352]', JSON.stringify(p352.regions))
  check(
    '352 年：前燕据河北、前秦据关中、张平据并州、代据朔方',
    p352.regions.hebei === 'qianyan' &&
      p352.regions.guanzhong === 'qianqin' &&
      p352.regions.bingzhou === 'zhangping' &&
      p352.regions.shuofang === 'dai',
    JSON.stringify(p352.regions),
  )

  check('352 有两支行军路线', p352.routes === 2, `${p352.routes}`)

  await page.hover('[data-region="hebei"]')
  await sleep(500)
  const hot = await page.evaluate(() => ({
    total: document.querySelectorAll('.jc-region.is-hot').length,
    qianyan: document.querySelectorAll('.jc-region.is-hot[data-regime="qianyan"]').length,
  }))
  check('悬浮河北时，前燕的河北、辽西一起高亮', hot.total === 2 && hot.qianyan === 2, JSON.stringify(hot))
  await page.mouse.move(10, 10)
  await sleep(300)

  const p376 = await jump(7)
  console.log('[376]', JSON.stringify(p376.regions))
  const north = ['hexi', 'longyou', 'shuofang', 'bingzhou', 'hebei', 'liaoxi', 'guanzhong', 'zhongyuan', 'shandong', 'bashu']
  check(
    '376 年：前秦统一北方并取巴蜀',
    north.every((r) => p376.regions[r] === 'qianqin') &&
      p376.regions.jiangnan === 'dongjin' &&
      p376.regions.jingxiang === 'dongjin',
    JSON.stringify(p376.regions),
  )

  const p398 = await jump(9)
  console.log('[398]', JSON.stringify(p398.regions))
  check(
    '398 年：北魏入河北、南燕据山东、后秦据关中、洛阳仍属东晋',
    p398.regions.hebei === 'beiwei' &&
      p398.regions.shandong === 'nanyan' &&
      p398.regions.guanzhong === 'houqin' &&
      p398.regions.liaoxi === 'houyan' &&
      p398.regions.zhongyuan === 'dongjin',
    JSON.stringify(p398.regions),
  )

  const p420 = await jump(12)
  console.log('[420]', JSON.stringify(p420))
  check(
    '420 年：江南归宋、关中归夏、河北归北魏、辽西归北燕',
    p420.regions.jiangnan === 'song' &&
      p420.regions.guanzhong === 'xia' &&
      p420.regions.hebei === 'beiwei' &&
      p420.regions.liaoxi === 'beiyan' &&
      p420.regions.lingnan === 'song',
    JSON.stringify(p420.regions),
  )
  check(
    '420 年：河西属北凉、陇右属西秦',
    p420.regions.hexi === 'beiliang' && p420.regions.longyou === 'xiqin',
    `${p420.regions.hexi}/${p420.regions.longyou}`,
  )
  check('420 年图例含宋与北魏', p420.chips.some((c) => c?.startsWith('宋')) && p420.chips.some((c) => c?.startsWith('北魏')), p420.chips.join(' '))
  check('末幕按钮为「进入南北朝」', (await page.$eval('.jc-actions .jc-primary', (n) => n.textContent?.trim())) === '进入南北朝 →')

  await page.keyboard.press('ArrowLeft')
  await sleep(400)
  check('键盘 ← 可回上一幕', (await page.evaluate(() => document.querySelector('.jc-stepno span')?.textContent)) === '417年')

  await page.keyboard.press('Escape')
  await sleep(700)
  check('ESC 回到晋时间轴', page.url().endsWith('/dynasty/jin'), page.url())

  // 420 年收尾按钮必须把用户送进南北朝时间轴（而不是回主页）
  await page.goto(`${BASE}/dynasty/jin/endgame`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('.jin-chronicle')
  await sleep(500)
  await page.click('.jc-node[data-step="12"]')
  await sleep(500)
  await page.click('.jc-actions .jc-primary')
  await page.waitForSelector('.nanbei', { timeout: 8000 })
  check('420 年「进入南北朝」跳转到南北朝时间轴', page.url().endsWith('/dynasty/southern_northern'), page.url())

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






