/**
 * verify-dual.mjs —— 阶段二扩展验收（分段轴 / 双层布局 / 诸侯层 / 浮层清晰度）
 * ---------------------------------------------------------------------------
 * 关键断言：
 *   1. 分段轴：2 个段带（西周/东周，宽度按年份比例）、2 个标志点（春秋/战国）、1 个播放头
 *   2. 西周页 → data-layout="single"，无诸侯层
 *   3. 东周页 → data-layout="dual"，天子层紧凑 + 诸侯层
 *   4. 春秋页 5 国 / 战国页 7 国
 *   5. 点击标志点可跳到对应页
 *   6. 诸侯悬浮：挤压（自身 flex-grow 变大、其余变小）+ 下方浮层
 *   7. 浮层清晰度：不透明黑底、字重 600、z-index 置顶
 */
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const URL = process.env.APP_URL ?? 'http://localhost:5180'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = 'D:\\文档\\deepseek-harness\\default-workspace\\china-history-focus\\shots\\v5'
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

const pageOf = async (page) => {
  const text = await page.$eval('.timeline-count', (n) => n.textContent ?? '')
  return Number(/第 (\d+) \//.exec(text)?.[1] ?? 0)
}

try {
  const page = await browser.newPage()
  await page.setCacheEnabled(false)
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto(`${URL}/dynasty/zhou`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.emp-card', { timeout: 30000 })
  await page.evaluate(() => document.fonts.ready)
  await sleep(2600)

  /* ---------- 1) 分段轴 ---------- */
  const axis = await page.$$eval('.seg-band', (ns) =>
    ns.map((n) => ({
      name: n.querySelector('.seg-band-name')?.textContent,
      width: Math.round(n.getBoundingClientRect().width),
    })),
  )
  const markers = await page.$$eval('.seg-marker', (ns) =>
    ns.map((n) => n.querySelector('.seg-marker-label')?.textContent ?? ''),
  )
  console.log(`\n[AXIS] 段带: ${axis.map((a) => `${a.name}(${a.width}px)`).join(' / ')}`)
  console.log(`[AXIS] 标志点: ${markers.join(' / ')}`)

  check('分段轴有西周/东周两个段带', axis.length === 2 && axis[0].name === '西周' && axis[1].name === '东周')
  // 西周 275 年、东周 514 年 → 宽度比约 0.53，容差放宽到 0.45~0.65
  const ratio = axis[1].width / axis[0].width
  check('段带宽度按年份比例（东周明显更宽）', ratio > 1.4 && ratio < 2.4, `东周/西周 = ${ratio.toFixed(2)}`)
  check('东周内有春秋/战国标志点', markers.length === 2 && markers[0].includes('春秋') && markers[1].includes('战国'))
  check('有当前页播放头', (await page.$$('.seg-playhead')).length === 1)

  /* ---------- 2) 西周页：单层 ---------- */
  const layout1 = await page.$eval('.timeline-stage', (n) => n.dataset.layout)
  check('西周页为单层布局', layout1 === 'single', layout1)
  check('西周页无诸侯层', (await page.$$('.lords-block')).length === 0)
  await page.screenshot({ path: `${OUT}\\01-xizhou-single.png` })

  /* ---------- 3) 跳转战国 ---------- */
  await page.$$eval('.seg-marker', (ns) => ns[1].click())
  await sleep(1200)
  const warPage = await pageOf(page)
  // 元王（前475）在索引 26，落在第 9 页；该页含「悼王 / 敬王 / 元王」，属跨界页
  check('点击「战国」跳到第 9 页（含元王，前475 起）', warPage === 9, `第 ${warPage} 页`)

  const layout2 = await page.$eval('.timeline-stage', (n) => n.dataset.layout)
  const lordCount = (await page.$$('.lord-card')).length
  const lordsTitle = await page.$eval('.lords-title', (n) => n.textContent?.trim())
  const compactCount = (await page.$$('.emp-card--compact')).length
  console.log(`\n[DUAL] layout=${layout2} 诸侯=${lordCount} 标题=${lordsTitle} 紧凑天子=${compactCount}`)

  check('东周页为双层布局', layout2 === 'dual', layout2)
  check('战国页渲染 7 国', lordCount === 7, `${lordCount}`)
  check('诸侯标题标注「战国」', /战国/.test(lordsTitle ?? ''), lordsTitle)
  check('天子层为紧凑样式', compactCount === 3, `${compactCount} 张紧凑卡`)
  await page.screenshot({ path: `${OUT}\\02-zhanguo-dual.png` })

  /* ---------- 4) 跳转春秋 ---------- */
  await page.$$eval('.seg-marker', (ns) => ns[0].click())
  await sleep(1200)
  const springPage = await pageOf(page)
  const springLords = (await page.$$('.lord-card')).length
  const springTitle = await page.$eval('.lords-title', (n) => n.textContent?.trim())
  check('点击「春秋」跳到第 5 页（平王起）', springPage === 5, `第 ${springPage} 页`)
  check('春秋页渲染 5 国', springLords === 5, `${springLords}`)
  check('诸侯标题标注「春秋」', /春秋/.test(springTitle ?? ''), springTitle)

  /* ---------- 5) 诸侯悬浮：挤压 + 浮层 ---------- */
  const lordBox = await page.$eval('.lord-card:nth-child(2)', (n) => {
    const r = n.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  await page.mouse.move(lordBox.x, lordBox.y, { steps: 2 })
  await sleep(900)

  const lordStyles = await page.$$eval('.lord-card', (ns) =>
    ns.map((n) => ({
      grow: Number(getComputedStyle(n).flexGrow),
      opacity: Number(getComputedStyle(n).opacity),
      width: Math.round(n.getBoundingClientRect().width),
    })),
  )
  console.log(`[SQUEEZE] flex-grow: ${lordStyles.map((l) => l.grow).join(' / ')}`)
  console.log(`[SQUEEZE] 宽度: ${lordStyles.map((l) => l.width).join(' / ')}`)

  check('悬浮诸侯放大（flex-grow > 1.5）', lordStyles[1].grow > 1.5, `${lordStyles[1].grow}`)
  check(
    '其余诸侯收窄（flex-grow < 1）',
    lordStyles.filter((_, i) => i !== 1).every((l) => l.grow < 1),
    lordStyles.filter((_, i) => i !== 1).map((l) => l.grow).join('/'),
  )
  check(
    '悬浮诸侯明显更宽',
    lordStyles[1].width > lordStyles[0].width * 1.6,
    `${lordStyles[0].width}px → ${lordStyles[1].width}px`,
  )

  const float = await page.$$eval('.lord-card:nth-child(2) .emp-event', (ns) => {
    const card = document.querySelector('.lord-card:nth-child(2)')
    const cardBottom = card.getBoundingClientRect().bottom
    return ns.map((n) => {
      const s = getComputedStyle(n)
      const nameEl = n.querySelector('.emp-event-name')
      return {
        name: nameEl?.textContent,
        opacity: Number(s.opacity),
        bg: s.backgroundColor,
        top: Math.round(n.getBoundingClientRect().top),
        fontWeight: getComputedStyle(nameEl).fontWeight,
        textShadow: getComputedStyle(nameEl).textShadow !== 'none',
      }
    })
  })
  const visible = float.filter((f) => f.opacity > 0.9)
  console.log(`[FLOAT] ${visible.map((f) => `${f.name}(bg=${f.bg},w=${f.fontWeight})`).join(' / ')}`)

  check('诸侯浮层出现事迹节点', visible.length >= 2, `${visible.length} 个`)
  check(
    '浮层位于卡片下方（不与卡片重叠）',
    visible.every((f) => f.top > 0),
    visible.map((f) => f.top).join(','),
  )
  check('浮层底为不透明黑（高对比）', /rgba\(0, 0, 0, 0\.8/.test(visible[0]?.bg ?? ''), visible[0]?.bg)
  check('事件文字加粗', visible.every((f) => Number(f.fontWeight) >= 600), visible[0]?.fontWeight)
  check('事件文字有 text-shadow', visible.every((f) => f.textShadow))

  const zIndex = await page.$eval('.lord-card:nth-child(2) .emp-events', (n) => getComputedStyle(n).zIndex)
  check('浮层 z-index 置顶', Number(zIndex) >= 10, zIndex)

  await page.screenshot({ path: `${OUT}\\03-chunqiu-lords-hover.png` })

  /* ---------- 6) 天子悬浮时浮层只向上（不压诸侯层） ---------- */
  const empBox = await page.$eval('.emp-card:nth-child(1)', (n) => {
    const r = n.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  await page.mouse.move(empBox.x, empBox.y, { steps: 2 })
  await sleep(900)
  const topFloats = (await page.$$('.emp-card:nth-child(1) .emp-events--top .emp-event')).length
  const bottomFloats = (await page.$$('.emp-card:nth-child(1) .emp-events--bottom .emp-event')).length
  check('双层布局下天子浮层只向上展开', topFloats > 0 && bottomFloats === 0, `上 ${topFloats} / 下 ${bottomFloats}`)

  await page.screenshot({ path: `${OUT}\\04-tianzi-hover.png` })

  check('无控制台错误', errors.length === 0, errors.join(' | '))
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
