/**
 * verify-endgame.mjs —— 王朝覆灭（可逆沙盘）验收
 * ---------------------------------------------------------------------------
 * 覆盖：
 *   1. 时间轴末页 → 王朝覆灭；末页下滚也能进；覆灭页上滚回到末页
 *   2. 阶梯可逆：点齐→index6，再点赵→index2，魏楚燕齐必须回退
 *   3. 版图：墨色层 scaleX 随 index 变化（正反向同一套过渡）
 *   4. 聚焦：点国家 → 战报栏 22%→50%，地图 opacity .3 + grayscale
 *   5. Tooltip / 人物 Modal（点人物标签打开，点外部关闭）
 *   6. 字体：标题 方正小标简宋，正文 仿宋 fallback
 */
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const URL = process.env.APP_URL ?? 'http://localhost:5180'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = 'D:\\文档\\deepseek-harness\\default-workspace\\china-history-focus\\shots\\v7'
mkdirSync(OUT, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' :: ' + detail : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(String(e)))

  /* ---------- 1) 从时间轴末页进入 ---------- */
  await page.goto(`${URL}/dynasty/zhou`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.emp-card')
  await page.evaluate(() => document.fonts.ready)
  await sleep(2400)
  await page.$$eval('.timeline-dot', (ns) => ns[ns.length - 1].click())
  await sleep(1000)

  const ctaText = await page.$eval('.timeline-btn--endgame', (n) => n.textContent?.trim()).catch(() => null)
  check('末页入口更名为「王朝覆灭」', /王朝覆灭/.test(ctaText ?? ''), ctaText)

  await page.click('.timeline-btn--endgame')
  await sleep(1000)
  check('进入王朝覆灭页', /\/dynasty\/zhou\/endgame$/.test(page.url()), page.url())
  await page.waitForSelector('.map-stage', { timeout: 10000 })
  await sleep(700)

  /* ---------- 2) 初始态 ---------- */
  const idle = await page.evaluate(() => ({
    index: document.querySelector('.endgame-page')?.getAttribute('data-index'),
    regions: document.querySelectorAll('.region').length,
    captured: document.querySelectorAll('.region.is-captured').length,
    rails: document.querySelectorAll('.rail-node').length,
    hasIntro: Boolean(document.querySelector('.battle-intro')),
    hasEntry: Boolean(document.querySelector('.qin-entry')),
  }))
  console.log(`\n[IDLE] ${JSON.stringify(idle)}`)
  check('index 初始为 0', idle.index === '0', idle.index)
  check('地图渲染 7 个区域（含秦）', idle.regions === 7, `${idle.regions}`)
  check('初始只有秦为墨色', idle.captured === 1, `${idle.captured}`)
  check('阶梯含「战前」+6 国共 7 个节点', idle.rails === 7, `${idle.rails}`)
  check('初始显示序章', idle.hasIntro)
  check('初始无秦朝入口', !idle.hasEntry)
  await page.screenshot({ path: `${OUT}\\01-idle.png` })

  /* ---------- 3) 正推：点齐 → index 6 ---------- */
  await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('.rail-node')]
    nodes[nodes.length - 1].click()
  })
  await sleep(1000)
  const full = await page.evaluate(() => ({
    index: document.querySelector('.endgame-page')?.getAttribute('data-index'),
    captured: document.querySelectorAll('.region.is-captured').length,
    reports: document.querySelectorAll('.battle-item').length,
    hasEntry: Boolean(document.querySelector('.qin-entry')),
    hasSeal: Boolean(document.querySelector('.qin-seal-char')),
  }))
  console.log(`[FULL] ${JSON.stringify(full)}`)
  check('点「齐」推进到 index 6', full.index === '6', full.index)
  check('六国全部入秦图', full.captured === 7, `${full.captured}`)
  check('战报累计 6 条', full.reports === 6, `${full.reports}`)
  check('出现大秦帝国入口', full.hasEntry)
  check('秦印出现', full.hasSeal)
  await page.screenshot({ path: `${OUT}\\02-all-captured.png` })

  /* ---------- 4) 逆向回退：点赵 → index 2 ---------- */
  const inkOf = (nation) =>
    page.evaluate((id) => {
      const ink = document.querySelector(`[data-nation="${id}"] .region-ink`)
      if (!ink) return null
      const m = new DOMMatrixReadOnly(getComputedStyle(ink).transform)
      return Number(m.a.toFixed(3))
    }, nation)

  const beforeBack = {
    wei: await inkOf('wei'),
    chu: await inkOf('chu'),
    yan: await inkOf('yan'),
    qi: await inkOf('qi'),
  }

  await page.evaluate(() => document.querySelectorAll('.rail-node')[2].click()) // 战前/韩/赵 → index 2
  await sleep(1100)

  const back = await page.evaluate(() => ({
    index: document.querySelector('.endgame-page')?.getAttribute('data-index'),
    captured: document.querySelectorAll('.region.is-captured').length,
    reports: document.querySelectorAll('.battle-item').length,
    hasEntry: Boolean(document.querySelector('.qin-entry')),
  }))
  const afterBack = {
    wei: await inkOf('wei'),
    chu: await inkOf('chu'),
    yan: await inkOf('yan'),
    qi: await inkOf('qi'),
  }
  console.log(`\n[BACK] ${JSON.stringify(back)}`)
  console.log(`[INK ] 回退前 魏楚燕齐: ${Object.values(beforeBack).join(' / ')}`)
  console.log(`[INK ] 回退后 魏楚燕齐: ${Object.values(afterBack).join(' / ')}`)

  check('回退到 index 2', back.index === '2', back.index)
  check('已入秦图的只剩秦+韩+赵（3 个）', back.captured === 3, `${back.captured}`)
  check('战报回退为 2 条', back.reports === 2, `${back.reports}`)
  check('秦朝入口消失（不再是终局）', !back.hasEntry)
  check(
    '版图墨色随之回退（魏楚燕齐全归 0）',
    Object.values(afterBack).every((scale) => scale < 0.05),
    Object.values(afterBack).join('/'),
  )
  check(
    '回退前的墨色确实是满格',
    Object.values(beforeBack).every((scale) => scale > 0.95),
    Object.values(beforeBack).join('/'),
  )
  await page.screenshot({ path: `${OUT}\\03-rewound.png` })

  /* ---------- 5) 聚焦模式 ---------- */
  await page.evaluate(() => {
    const zhao = document.querySelector('[data-nation="zhao"]')
    zhao.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await sleep(900)
  const focus = await page.evaluate(() => {
    const panel = document.querySelector('.battle-panel')
    const map = document.querySelector('.map-stage')
    const body = document.querySelector('.endgame-body')
    const panelRect = panel.getBoundingClientRect()
    const bodyRect = body.getBoundingClientRect()
    return {
      focused: body.classList.contains('is-focused'),
      panelRatio: Number((panelRect.width / bodyRect.width).toFixed(2)),
      mapOpacity: Number(getComputedStyle(map).opacity),
      mapFilter: getComputedStyle(map).filter,
      activeTitle: document.querySelector('.battle-item.is-active .battle-item-title')?.textContent,
    }
  })
  console.log(`[FOCUS] ${JSON.stringify(focus)}`)
  check('点击国家进入聚焦', focus.focused)
  check('战报栏展开到约 50%', focus.panelRatio > 0.44 && focus.panelRatio < 0.56, `${focus.panelRatio}`)
  check('地图变暗（opacity ≤ 0.35）', focus.mapOpacity <= 0.35, `${focus.mapOpacity}`)
  check('地图灰化（grayscale）', /grayscale\(1\)/.test(focus.mapFilter), focus.mapFilter)
  check('聚焦到「秦灭赵」', focus.activeTitle === '秦灭赵', focus.activeTitle)
  await page.screenshot({ path: `${OUT}\\04-focused.png` })

  /* ---------- 6) 人物 Modal ---------- */
  const tagCount = await page.$$eval('.battle-item.is-active .figure-tag', (ns) => ns.length)
  check('战报中人物被高亮为可点击标签', tagCount >= 1, `${tagCount} 个`)

  await page.click('.battle-item.is-active .figure-tag')
  await sleep(500)
  const modal = await page.evaluate(() => ({
    open: Boolean(document.querySelector('.figure-modal')),
    name: document.querySelector('.figure-modal-name')?.textContent?.trim(),
    hasBio: Boolean(document.querySelector('.figure-modal-bio')?.textContent?.trim()),
    deeds: document.querySelectorAll('.figure-modal-deeds li').length,
  }))
  console.log(`[MODAL] ${JSON.stringify(modal)}`)
  check('点击人物标签打开 Modal', modal.open, modal.name)
  check('Modal 显示姓名与生平', Boolean(modal.name) && modal.hasBio)
  check('Modal 列出生平事迹', modal.deeds >= 1, `${modal.deeds}`)
  await page.screenshot({ path: `${OUT}\\05-figure-modal.png` })

  // 点击浮层外部关闭
  await page.mouse.click(60, 60)
  await sleep(400)
  check('点击浮层外部关闭 Modal', !(await page.$('.figure-modal')))

  /* ---------- 7) 退出聚焦 ---------- */
  await page.evaluate(() => {
    const bg = document.querySelector('.map-bg')
    bg.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await sleep(800)
  const exited = await page.evaluate(() => ({
    focused: document.querySelector('.endgame-body').classList.contains('is-focused'),
    mapOpacity: Number(getComputedStyle(document.querySelector('.map-stage')).opacity),
  }))
  check('点击地图空白处退出聚焦', !exited.focused)
  check('地图恢复亮度', exited.mapOpacity > 0.9, `${exited.mapOpacity}`)

  /* ---------- 8) Tooltip ---------- */
  // 取多边形本体（不是 <g>）的包围盒：墨层是撑满 viewBox 的矩形，会让 <g> 的盒失真
  const zhaoBox = await page.evaluate(() => {
    const el = document.querySelector('[data-nation="zhao"] .region-base')
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  await page.mouse.move(zhaoBox.x, zhaoBox.y, { steps: 2 })
  await sleep(400)
  const tip = await page.evaluate(() => ({
    visible: Boolean(document.querySelector('.map-tip')),
    text: document.querySelector('.map-tip')?.textContent?.replace(/\s+/g, ' ').trim(),
  }))
  console.log(`[TIP] ${tip.text}`)
  check('悬浮已灭国家出现 Tooltip', tip.visible)
  check('Tooltip 含「秦灭赵」简述', /秦灭赵/.test(tip.text ?? ''), tip.text)

  /* ---------- 9) 字体 ---------- */
  const fonts = await page.evaluate(() => ({
    title: getComputedStyle(document.querySelector('.battle-title')).fontFamily,
    body: getComputedStyle(document.querySelector('.battle-text')).fontFamily,
  }))
  check('战报标题字体含「方正小标简宋」', /方正小标简宋/.test(fonts.title), fonts.title)
  check('战报正文字体含「仿宋」fallback', /仿宋GB2312|FangSong/.test(fonts.body), fonts.body)

  /* ---------- 10) 滚轮回退到时间轴末页 ---------- */
  await page.mouse.move(800, 400)
  await page.mouse.wheel({ deltaY: -240 })
  await sleep(1200)
  check('上滚返回时间轴', /\/dynasty\/zhou$/.test(page.url()), page.url())
  const backPage = await page.$eval('.timeline-count', (n) => n.textContent?.trim()).catch(() => null)
  check('返回时停在最后一页（第 13 页）', /第 13 \/ 13 页/.test(backPage ?? ''), backPage)

  /* ---------- 11) 末页下滚进入覆灭 ---------- */
  await sleep(600)
  await page.mouse.move(800, 450)
  await page.mouse.wheel({ deltaY: 240 })
  await sleep(1200)
  check('末页继续下滚进入王朝覆灭', /\/endgame$/.test(page.url()), page.url())

  check('无控制台错误', errors.length === 0, errors.slice(0, 2).join(' | '))
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.pass)
console.log(`\n===== ${results.length - failed.length}/${results.length} passed =====`)
if (failed.length) {
  console.log('FAILED:')
  for (const f of failed) console.log(` - ${f.name} :: ${f.detail}`)
  process.exitCode = 1
}
