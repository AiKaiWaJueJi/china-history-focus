/**
 * verify-dual.mjs —— 阶段二扩展验收
 * ---------------------------------------------------------------------------
 * 覆盖：
 *   1. 分段轴：2 段带（按年份比例）、2 标志点、播放头**宽度恒定只移动**
 *   2. 布局切换：西周 single / 东周 dual（天子 compact + 诸侯层）
 *   3. 诸侯**时间联动**：与当前页时间窗求交，逐页增减；无霸主时显示空态
 *   4. 诸侯悬浮：挤压 + 下方事迹浮层（高对比、加粗、置顶）
 *   5. 双层布局下天子浮层只向上
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
  const ratio = axis[1].width / axis[0].width
  check('段带宽度按年份比例（东周明显更宽）', ratio > 1.4 && ratio < 2.4, `东周/西周 = ${ratio.toFixed(2)}`)
  check('东周内有春秋/战国标志点', markers.length === 2 && markers[0].includes('春秋') && markers[1].includes('战国'))

  /* ---------- 2) 播放头：宽度恒定 ---------- */
  const playhead = async () =>
    page.$eval('.seg-playhead', (n) => {
      const r = n.getBoundingClientRect()
      return { w: Math.round(r.width), left: Math.round(r.left) }
    })
  const ph0 = await playhead()
  const widths = [ph0.w]
  const lefts = [ph0.left]
  // 逐页点页码点，而不是滚轮连滚 —— 第 4 页下滚会进「平王东迁」过渡页
  const dotCount = await page.$$eval('.timeline-dot', (ns) => ns.length)
  for (let i = 1; i < dotCount; i++) {
    await page.evaluate((idx) => document.querySelectorAll('.timeline-dot')[idx]?.click(), i)
    await sleep(460)
    const ph = await playhead()
    widths.push(ph.w)
    lefts.push(ph.left)
  }
  console.log(`\n[PLAYHEAD] 宽度: ${[...new Set(widths)].join(' / ')}px（共 ${widths.length} 页）`)
  console.log(`[PLAYHEAD] 左端范围: ${Math.min(...lefts)} → ${Math.max(...lefts)}px`)

  check('播放头宽度全程恒定（不再忽宽忽细）', new Set(widths).size === 1, `${[...new Set(widths)].join('/')}px`)
  check('播放头位置随页移动', new Set(lefts).size >= 10, `${new Set(lefts).size} 个不同位置`)

  /* ---------- 3) 诸侯时间联动：逐页核对 ---------- */
  const gotoTail = async () => {
    await page.goto(`${URL}/dynasty/zhou`, { waitUntil: 'networkidle2' })
    await page.waitForSelector('.emp-card')
    await page.evaluate(() => document.fonts.ready)
    await sleep(2200)
  }
  const gotoPage = async (index) => {
    // 用进度点直接跳页，避免受滚轮冷却影响
    await page.$$eval('.timeline-dot', (ns, i) => ns[i].click(), index)
    await sleep(1000)
  }
  const snapshot = async () => {
    const info = await page.evaluate(() => ({
      page: Number(/第 (\d+) \//.exec(document.querySelector('.timeline-count')?.textContent ?? '')?.[1] ?? 0),
      layout: document.querySelector('.timeline-stage')?.dataset.layout,
      lords: Array.from(document.querySelectorAll('.lord-state')).map((n) => n.textContent),
      slots: document.querySelectorAll('.lord-slot').length,
      empty: Boolean(document.querySelector('.lords-empty')),
      countText: document.querySelector('.lords-count')?.textContent?.trim(),
    }))
    return info
  }

  await gotoTail()

  // 期望值按**称霸期**求交得出（不是在位期）：
  //   第 5 页 前770–前682：齐桓前679才始霸 → 0
  //   第 6 页 前681–前619：齐桓(679-643)、晋文(632-628) → 2
  //   第 7 页 前618–前586：楚庄(606-591) → 1
  //   第 8 页 前585–前520：楚庄已终、吴越未兴 → 0
  //   第 9 页 前520–前469：吴(506-496)、越(473-465) → 2
  //   第10 页 前468–前441：越霸尾声(465) → 1
  const expectations = [
    { index: 4, page: 5, lords: 0, note: '齐桓尚未始霸' },
    { index: 5, page: 6, lords: 2, note: '齐桓、晋文' },
    { index: 6, page: 7, lords: 1, note: '楚庄问鼎' },
    { index: 7, page: 8, lords: 0, note: '霸业空窗期' },
    { index: 8, page: 9, lords: 2, note: '吴阖闾、越勾践' },
    { index: 9, page: 10, lords: 1, note: '越霸尾声' },
  ]

  for (const exp of expectations) {
    await gotoPage(exp.index)
    const snap = await snapshot()
    console.log(
      `\n[PAGE ${snap.page}] layout=${snap.layout} 诸侯=[${snap.lords.join(',')}] 空槽=${snap.slots} 空态=${snap.empty} 文案=「${snap.countText}」`,
    )
    check(`第 ${exp.page} 页为双层布局`, snap.layout === 'dual', snap.layout)
    check(
      `第 ${exp.page} 页在任诸侯 ${exp.lords} 国（${exp.note}）`,
      snap.lords.length === exp.lords,
      `实际 ${snap.lords.length}：${snap.lords.join(',')}`,
    )

    if (exp.lords === 0) {
      check(`第 ${exp.page} 页显示无霸主空态`, snap.empty, `empty=${snap.empty}`)
    } else {
      check(
        `第 ${exp.page} 页不满 3 家时补空槽（宽度恒定）`,
        snap.slots === 3 - exp.lords,
        `空槽 ${snap.slots}`,
      )
    }
  }

  /* ---------- 4) 西周页：单层 ---------- */
  await gotoPage(0)
  const west = await snapshot()
  check('西周页为单层布局', west.layout === 'single', west.layout)
  check('西周页无诸侯层', (await page.$$('.lords-block')).length === 0)
  await page.screenshot({ path: `${OUT}\\01-xizhou-single.png` })

  /* ---------- 5) 诸侯悬浮：挤压 + 浮层 ---------- */
  await gotoPage(5) // 第 6 页：齐桓 + 晋文
  const lordSnap = await snapshot()
  console.log(`\n[HOVER-PAGE] 第 ${lordSnap.page} 页 诸侯=[${lordSnap.lords.join(',')}]`)
  await page.screenshot({ path: `${OUT}\\02-dual-two-lords.png` })

  const lordBox = await page.$eval('.lord-card:nth-child(2)', (n) => {
    const r = n.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  await page.mouse.move(lordBox.x, lordBox.y, { steps: 2 })
  await sleep(900)

  const lordStyles = await page.$$eval('.lord-card', (ns) =>
    ns.map((n) => ({
      grow: Number(getComputedStyle(n).flexGrow),
      width: Math.round(n.getBoundingClientRect().width),
    })),
  )
  console.log(`[SQUEEZE] flex-grow: ${lordStyles.map((l) => l.grow).join(' / ')}`)

  check('悬浮诸侯放大（flex-grow > 1.5）', lordStyles[1].grow > 1.5, `${lordStyles[1].grow}`)
  check(
    '其余诸侯收窄（flex-grow < 1）',
    lordStyles.filter((_, i) => i !== 1).every((l) => l.grow < 1),
    lordStyles.filter((_, i) => i !== 1).map((l) => l.grow).join('/'),
  )

  const float = await page.$$eval('.lord-card:nth-child(2) .emp-event', (ns) =>
    ns.map((n) => {
      const s = getComputedStyle(n)
      const nameEl = n.querySelector('.emp-event-name')
      return {
        name: nameEl?.textContent,
        opacity: Number(s.opacity),
        bg: s.backgroundColor,
        fontWeight: getComputedStyle(nameEl).fontWeight,
        textShadow: getComputedStyle(nameEl).textShadow !== 'none',
      }
    }),
  )
  const visible = float.filter((f) => f.opacity > 0.9)
  console.log(`[FLOAT] ${visible.map((f) => f.name).join(' / ')}`)
  const hegemonyText = await page.$eval('.lord-card:nth-child(2) .lord-hegemony', (n) => n.textContent?.trim())
  console.log(`[HEGEMONY] ${hegemonyText}`)
  check('卡片标出称霸期（与在位区分）', /称霸 前\d+—前\d+/.test(hegemonyText ?? ''), hegemonyText)

  check('诸侯浮层出现事迹节点', visible.length >= 2, `${visible.length} 个`)
  check('浮层底为不透明黑', /rgba\(0, 0, 0, 0\.8/.test(visible[0]?.bg ?? ''), visible[0]?.bg)
  check('事件文字加粗且有投影', visible.every((f) => Number(f.fontWeight) >= 600 && f.textShadow))

  await page.screenshot({ path: `${OUT}\\03-lords-hover.png` })

  /* ---------- 6) 天子浮层只向上 ---------- */
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
