/**
 * verify-endgame.mjs —— 王朝覆灭（可逆沙盘 · 分层浮现）验收
 * ---------------------------------------------------------------------------
 * 本轮重构后的验收重点：
 *   1. 默认无战报栏（地图独占），悬浮只出要点卡片
 *   2. 点击国家 → 展开详细战报（战前形势 / 经过 / 结局 三段）
 *   3. 点击外部 → 关闭战报
 *   4. 地图悬浮 ↔ 底部节点流光 双向联动
 *   5. 国都（7 座）渲染正确
 *   6. 已取消"滚轮返回上一页"，改为按钮
 */
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const URL = process.env.APP_URL ?? 'http://localhost:5180'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = 'D:\\文档\\deepseek-harness\\default-workspace\\china-history-focus\\shots\\v8'
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
  check('末页入口为「王朝覆灭」', /王朝覆灭/.test(ctaText ?? ''), ctaText)
  await page.click('.timeline-btn--endgame')
  await sleep(1000)
  await page.waitForSelector('.map-stage', { timeout: 10000 })
  await sleep(600)

  /* ---------- 2) 初始态：无战报栏 ---------- */
  const idle = await page.evaluate(() => ({
    index: document.querySelector('.endgame-page')?.getAttribute('data-index'),
    regions: document.querySelectorAll('.region').length,
    captured: document.querySelectorAll('.region.is-captured').length,
    rails: document.querySelectorAll('.rail-node').length,
    hasPanel: Boolean(document.querySelector('.battle-panel')),
    capitals: [...document.querySelectorAll('.capital-label')].map((n) => n.textContent?.trim()),
  }))
  console.log(`\n[IDLE] ${JSON.stringify(idle)}`)
  check('index 初始为 0', idle.index === '0', idle.index)
  check('地图 7 个区域', idle.regions === 7, `${idle.regions}`)
  check('初始只有秦为墨色', idle.captured === 1, `${idle.captured}`)
  check('阶梯 7 个节点（战前 + 6 国）', idle.rails === 7, `${idle.rails}`)
  check('默认不显示战报栏（地图独占）', !idle.hasPanel)
  check(
    '渲染 7 座国都',
    idle.capitals.length === 7 &&
      ['咸阳', '新郑', '邯郸', '大梁', '寿春', '蓟', '临淄'].every((name) => idle.capitals.includes(name)),
    idle.capitals.join('/'),
  )
  await page.screenshot({ path: `${OUT}\\01-idle.png` })

  /* ---------- 3) 正推 / 逆推 ---------- */
  await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('.rail-node')]
    nodes[nodes.length - 1].click()
  })
  await sleep(1000)
  const full = await page.evaluate(() => ({
    index: document.querySelector('.endgame-page')?.getAttribute('data-index'),
    captured: document.querySelectorAll('.region.is-captured').length,
    hasEntry: Boolean(document.querySelector('.qin-entry')),
  }))
  check('点「齐」推进到 index 6', full.index === '6', full.index)
  check('六国全部入秦图', full.captured === 7, `${full.captured}`)
  check('出现大秦帝国入口', full.hasEntry)
  await page.screenshot({ path: `${OUT}\\02-all-captured.png` })

  /* ---------- 3b) 一统效果：拉镜 + 秦字转红放大 + 始皇虚影 ---------- */
  await sleep(1900)
  const unified = await page.evaluate(() => {
    const stage = document.querySelector('.map-stage')
    const svg = document.querySelector('.map-svg')
    const qinLabel = document.querySelector('[data-nation="qin"] .region-label')
    const emperor = document.querySelector('.map-photo--emperor')
    const m = new DOMMatrixReadOnly(getComputedStyle(svg).transform)
    const cs = getComputedStyle(qinLabel)
    return {
      dataUnified: stage.getAttribute('data-unified'),
      scale: Number(m.a.toFixed(2)),
      qinFill: cs.fill,
      qinSize: Math.round(parseFloat(cs.fontSize)),
      emperorOpacity: Number(getComputedStyle(emperor).opacity),
      hasSeal: Boolean(document.querySelector('.qin-seal-char')),
      fadedLabels: [...document.querySelectorAll('.region:not(.is-qin) .region-label')].filter(
        (n) => Number(getComputedStyle(n).opacity) < 0.1,
      ).length,
    }
  })
  console.log(`[UNIFIED] ${JSON.stringify(unified)}`)
  check('进入一统态（data-unified）', unified.dataUnified === 'true', unified.dataUnified)
  check('视角拉近（scale > 1.15）', unified.scale > 1.15, `${unified.scale}`)
  check(
    '秦字转红并放大',
    /192,\s*57,\s*43/.test(unified.qinFill) && unified.qinSize >= 140,
    `${unified.qinFill} · ${unified.qinSize}px`,
  )
  check('始皇虚影淡入', unified.emperorOpacity > 0.4, `${unified.emperorOpacity}`)
  check('不再有红色巨型秦印', !unified.hasSeal)
  check('六国国名全部消散', unified.fadedLabels === 6, `${unified.fadedLabels}/6`)
  await page.screenshot({ path: `${OUT}\\02b-unified.png` })


  // 秦色覆盖层现在用 opacity 淡入（"填成秦色"），不再是 scaleX 擦除
  const inkOf = (nation) =>
    page.evaluate((id) => {
      const ink = document.querySelector(`[data-nation="${id}"] .region-ink`)
      if (!ink) return null
      return Number(Number(getComputedStyle(ink).opacity).toFixed(3))
    }, nation)

  const beforeBack = { wei: await inkOf('wei'), chu: await inkOf('chu'), qi: await inkOf('qi') }
  await page.evaluate(() => document.querySelectorAll('.rail-node')[2].click()) // → index 2
  await sleep(1100)
  const back = await page.evaluate(() => ({
    index: document.querySelector('.endgame-page')?.getAttribute('data-index'),
    captured: document.querySelectorAll('.region.is-captured').length,
    hasEntry: Boolean(document.querySelector('.qin-entry')),
    hasPanel: Boolean(document.querySelector('.battle-panel')),
  }))
  const afterBack = { wei: await inkOf('wei'), chu: await inkOf('chu'), qi: await inkOf('qi') }
  console.log(`\n[BACK] ${JSON.stringify(back)} · 墨色 ${Object.values(beforeBack)} → ${Object.values(afterBack)}`)
  check('回退到 index 2', back.index === '2', back.index)
  check('已入秦图的只剩 3 个（秦+韩+赵）', back.captured === 3, `${back.captured}`)
  check('秦朝入口消失', !back.hasEntry)
  check('回退后仍无战报栏', !back.hasPanel)
  check(
    '版图墨色随之回退',
    Object.values(afterBack).every((v) => v < 0.05) && Object.values(beforeBack).every((v) => v > 0.95),
    `${Object.values(beforeBack).join('/')} → ${Object.values(afterBack).join('/')}`,
  )

  /* ---------- 4) 悬浮：要点卡片 + 底部节点流光 ---------- */
  const zhaoBox = await page.evaluate(() => {
    const el = document.querySelector('[data-nation="zhao"] .region-base')
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  await page.mouse.move(zhaoBox.x, zhaoBox.y, { steps: 3 })
  await sleep(500)

  const hover = await page.evaluate(() => ({
    tip: Boolean(document.querySelector('.map-tip')),
    title: document.querySelector('.map-tip-title')?.textContent?.trim(),
    points: [...document.querySelectorAll('.map-tip-list li')].map((n) => n.textContent?.trim()),
    action: document.querySelector('.map-tip-action')?.textContent?.trim(),
    railHovered: [...document.querySelectorAll('.rail-node.is-hovered')].map(
      (n) => n.querySelector('.rail-node-name')?.textContent?.trim(),
    ),
    hasPanel: Boolean(document.querySelector('.battle-panel')),
  }))
  console.log(`[HOVER] ${JSON.stringify(hover)}`)
  check('悬浮出现要点卡片', hover.tip)
  check('卡片标题为「秦灭赵」', hover.title === '秦灭赵', hover.title)
  check('卡片列出 2-3 条要点', hover.points.length >= 2 && hover.points.length <= 3, hover.points.join(' / '))
  check('卡片提示可点击查看详情', /查看详情/.test(hover.action ?? ''), hover.action)
  check('悬浮时仍然不展开战报', !hover.hasPanel)
  check(
    '底部对应节点同步高亮（流光）',
    hover.railHovered.length === 1 && hover.railHovered[0] === '赵',
    hover.railHovered.join('/'),
  )
  await page.screenshot({ path: `${OUT}\\03-hover.png` })

  /* ---------- 5) 点击：展开详细战报 ---------- */
  await page.mouse.click(zhaoBox.x, zhaoBox.y)
  await sleep(900)
  const panel = await page.evaluate(() => {
    const sections = [...document.querySelectorAll('.battle-section')].map((n) => ({
      label: n.querySelector('.battle-section-label')?.textContent?.trim(),
      len: (n.querySelector('.battle-text')?.textContent ?? '').trim().length,
    }))
    const map = document.querySelector('.map-stage')
    return {
      open: Boolean(document.querySelector('.battle-panel')),
      title: document.querySelector('.battle-title')?.textContent?.trim(),
      sections,
      mapOpacity: Number(getComputedStyle(map).opacity),
      mapFilter: getComputedStyle(map).filter,
      figureTags: document.querySelectorAll('.battle-panel .figure-tag').length,
      panelWidth: Math.round(document.querySelector('.battle-panel').getBoundingClientRect().width),
    }
  })
  console.log(`[PANEL] ${JSON.stringify(panel)}`)
  check('点击国家展开战报', panel.open && panel.title === '秦灭赵', panel.title)
  check(
    '战报含「战前形势 / 战役经过 / 结局」三段',
    panel.sections.length === 3 &&
      panel.sections[0].label === '战前形势' &&
      panel.sections[1].label === '战役经过' &&
      panel.sections[2].label === '结局',
    panel.sections.map((s) => s.label).join('/'),
  )
  check(
    '详细内容是长文（非简介复述，每段 >40 字）',
    panel.sections.every((s) => s.len > 40),
    panel.sections.map((s) => s.len).join('/'),
  )
  check('地图变暗灰化', panel.mapOpacity <= 0.35 && /grayscale\(1\)/.test(panel.mapFilter), `${panel.mapOpacity}`)
  check('正文人物被高亮为可点击标签', panel.figureTags >= 1, `${panel.figureTags}`)
  await page.screenshot({ path: `${OUT}\\04-detail.png` })

  /* ---------- 6) 人物 Modal ---------- */
  await page.click('.battle-panel .figure-tag')
  await sleep(500)
  const modal = await page.evaluate(() => ({
    open: Boolean(document.querySelector('.figure-modal')),
    name: document.querySelector('.figure-modal-name')?.textContent?.trim(),
    deeds: document.querySelectorAll('.figure-modal-deeds li').length,
  }))
  check('点击人物标签打开 Modal', modal.open, modal.name)
  check('Modal 有生平事迹', modal.deeds >= 1, `${modal.deeds}`)
  await page.screenshot({ path: `${OUT}\\05-figure.png` })
  await page.keyboard.press('Escape')
  await sleep(400)
  check('ESC 关闭 Modal 且保留战报', !(await page.$('.figure-modal')) && Boolean(await page.$('.battle-panel')))

  /* ---------- 7) 点击外部关闭战报 ---------- */
  await page.evaluate(() => {
    document.querySelector('.map-bg').dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await sleep(80)
  const closingNow = await page.evaluate(() => {
    const panel = document.querySelector('.battle-panel')
    return {
      exists: Boolean(panel),
      closing: panel ? panel.classList.contains('is-closing') : false,
    }
  })
  check(
    '关闭时先播退场动画（is-closing）',
    closingNow.exists && closingNow.closing,
    JSON.stringify(closingNow),
  )

  await sleep(500)
  const closed = await page.evaluate(() => ({
    hasPanel: Boolean(document.querySelector('.battle-panel')),
    mapOpacity: Number(getComputedStyle(document.querySelector('.map-stage')).opacity),
  }))
  check('退场结束后才卸载面板', !closed.hasPanel)
  check('地图恢复亮度', closed.mapOpacity > 0.9, `${closed.mapOpacity}`)

  /* ---------- 8) 取消滚轮返回，改为按钮 ---------- */
  await page.mouse.move(800, 400)
  await page.mouse.wheel({ deltaY: -260 })
  await sleep(1000)
  check('滚轮上滑不再返回时间轴', /\/endgame$/.test(page.url()), page.url())

  await page.click('.endgame-btn')
  await sleep(1100)
  check('点击「返回时间轴」可返回', /\/dynasty\/zhou$/.test(page.url()), page.url())
  const backPage = await page.$eval('.timeline-count', (n) => n.textContent?.trim()).catch(() => null)
  check('返回时停在最后一页', /第 13 \/ 13 页/.test(backPage ?? ''), backPage)

  /* ---------- 9) 末页下滚仍可进入覆灭 ---------- */
  await sleep(600)
  await page.mouse.move(800, 450)
  await page.mouse.wheel({ deltaY: 240 })
  await sleep(1200)
  check('末页下滚仍可进入王朝覆灭', /\/endgame$/.test(page.url()), page.url())

  /* ---------- 10) 字体 ---------- */
  const fonts = await page.evaluate(() => {
    document.querySelectorAll('.rail-node')[6]?.click()
    return null
  })
  await sleep(900)
  const fontInfo = await page.evaluate(() => {
    const el = document.createElement('div')
    el.className = 'battle-panel'
    return {
      titleRule: [...document.styleSheets]
        .flatMap((sheet) => {
          try {
            return [...sheet.cssRules]
          } catch {
            return []
          }
        })
        .filter((rule) => rule.cssText?.includes('.battle-title') || rule.cssText?.includes('.battle-text'))
        .map((rule) => rule.cssText.slice(0, 120)),
    }
  })
  const fontText = (fontInfo.titleRule ?? []).join(' ')
  check(
    '战报字体规则含「方正小标简宋」与「仿宋」',
    /方正小标简宋/.test(fontText) && /仿宋GB2312/.test(fontText),
    fontText.includes('方正小标简宋') ? 'ok' : 'missing',
  )

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
