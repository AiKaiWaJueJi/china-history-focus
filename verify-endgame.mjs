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

  /*
    点击国家会先播战役序列（约 2s/段），战报在播完后才出现。
    测试里用"单击启动 + 派发 dblclick 跳过"来快速到达战报。
  */
  const openReportByClick = async (box) => {
    await page.mouse.click(box.x, box.y)
    await sleep(140)
    await page.evaluate(() => {
      document
        .querySelector('.map-stage')
        ?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    })
    await sleep(600)
  }
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

  /* ---------- 2b) 战役序列播放器 ---------- */
  const campaignBox = await page.evaluate(() => {
    const el = document.querySelector('[data-nation="han"] .region-base')
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  await page.mouse.click(campaignBox.x, campaignBox.y) // 单击启动序列
  await sleep(260)
  const play0 = await page.evaluate(() => ({
    panel: Boolean(document.querySelector('.battle-panel')),
    routes: document.querySelectorAll('.campaign-route').length,
    current: document.querySelectorAll('.campaign-route.is-current').length,
  }))
  console.log(`[CAMPAIGN-0] ${JSON.stringify(play0)}`)
  check('单击国家开始播放战役序列', play0.routes === 3 && play0.current === 1, `${play0.current}/${play0.routes}`)
  check('动画未播完时不弹战报', !play0.panel)

  await sleep(2200)
  const play1 = await page.evaluate(() => ({
    played: document.querySelectorAll('.campaign-route.is-played').length,
    panel: Boolean(document.querySelector('.battle-panel')),
  }))
  console.log(`[CAMPAIGN-1] ${JSON.stringify(play1)}`)
  check('序列按 phase 自动推进', play1.played >= 1, `${play1.played} 段已播`)
  check('推进过程中仍不弹战报', !play1.panel)

  await page.evaluate(() =>
    document.querySelector('.map-stage')?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })),
  )
  await sleep(800)
  const play2 = await page.evaluate(() => ({
    panel: Boolean(document.querySelector('.battle-panel')),
    played: document.querySelectorAll('.campaign-route.is-played').length,
    items: document.querySelectorAll('.campaign-item').length,
  }))
  console.log(`[CAMPAIGN-2] ${JSON.stringify(play2)}`)
  check('双击跳过后直接进入战报', play2.panel)
  check('跳过后三段路线全部保留', play2.played === 3, `${play2.played}`)
  check('战报列出三条进军', play2.items === 3, `${play2.items}`)

  // 战报里 hover 进军条目 → 地图重新点亮对应路线（且不带文字）
  await page.hover('.campaign-item')
  await sleep(400)
  const hoverRoute = await page.evaluate(() => {
    const hot = document.querySelector('.campaign-route.is-hovered')
    const caption = hot?.querySelector('.campaign-caption')
    return {
      hovered: document.querySelectorAll('.campaign-route.is-hovered').length,
      captionOpacity: caption ? Number(getComputedStyle(caption).opacity) : null,
    }
  })
  console.log(`[CAMPAIGN-HOVER] ${JSON.stringify(hoverRoute)}`)
  check('hover 战报条目点亮对应路线', hoverRoute.hovered === 1, `${hoverRoute.hovered}`)
  check('hover 复现的路线不显示文字', (hoverRoute.captionOpacity ?? 1) < 0.1, `${hoverRoute.captionOpacity}`)

  // 收尾：关战报、回到战前
  await page.evaluate(() =>
    document.querySelector('.map-bg')?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
  )
  await sleep(600)
  await page.evaluate(() => document.querySelectorAll('.rail-node')[0].click())
  await sleep(800)

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

  /* ---------- 3b) 一统：图块消散 + 秦字独立成章 ---------- */
  await sleep(4200) // 等 3.8s 的秦字动画走完
  const unified = await page.evaluate(() => {
    const stage = document.querySelector('.map-stage')
    const svg = document.querySelector('.map-svg')
    const char = document.querySelector('.unify-char')
    const ring = document.querySelector('.unify-ring')
    const qiEdge = document.querySelector('[data-nation="qi"] .region-edge')
    const cs = char ? getComputedStyle(char) : null
    return {
      dataUnified: stage.getAttribute('data-unified'),
      svgOpacity: Number(getComputedStyle(svg).opacity),
      hasHero: Boolean(document.querySelector('.unify-hero')),
      hasChar: Boolean(char),
      hasRing: Boolean(ring),
      charColor: cs ? cs.color : null,
      charScale: Number(new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.unify-core')).transform).a.toFixed(2)),
      qiEdgeOpacity: qiEdge ? Number(getComputedStyle(qiEdge).opacity) : null,
      fadedLabels: [...document.querySelectorAll('.region:not(.is-qin) .region-label')].filter(
        (n) => Number(getComputedStyle(n).opacity) < 0.1,
      ).length,
    }
  })
  console.log(`[UNIFIED] ${JSON.stringify(unified)}`)
  check('进入一统态（data-unified）', unified.dataUnified === 'true', unified.dataUnified)
  check('七国图块整体消散（svg opacity < 0.1）', unified.svgOpacity < 0.1, `${unified.svgOpacity}`)
  check('秦字独立成章（unify-hero）', unified.hasHero && unified.hasChar && unified.hasRing)
  check(
    '秦字由黄转红',
    Boolean(unified.charColor) && /^rgb\(1[5-9]\d,\s*[0-8]?\d,\s*[0-9]{1,2}\)$/.test(unified.charColor ?? ''),
    unified.charColor,
  )
  check('秦字放大（scale > 1.05）', unified.charScale > 1.05, `${unified.charScale}`)
  check('灭国后国界线消失（齐的描边透明）', (unified.qiEdgeOpacity ?? 1) < 0.1, `${unified.qiEdgeOpacity}`)
  check('六国国名全部消散', unified.fadedLabels === 6, `${unified.fadedLabels}/6`)
  const geom = await page.evaluate(() => {
    const ring = document.querySelector('.unify-ring').getBoundingClientRect()
    const char = document.querySelector('.unify-char').getBoundingClientRect()
    const stage = document.querySelector('.map-stage').getBoundingClientRect()
    return {
      dx: Math.round(char.x + char.width / 2 - (ring.x + ring.width / 2)),
      dy: Math.round(char.y + char.height / 2 - (ring.y + ring.height / 2)),
      inside:
        ring.top >= stage.top - 1 &&
        ring.bottom <= stage.bottom + 1 &&
        ring.left >= stage.left - 1 &&
        ring.right <= stage.right + 1,
      svgPointer: getComputedStyle(document.querySelector('.map-svg')).pointerEvents,
      regionPointer: getComputedStyle(document.querySelector('[data-nation="qi"]')).pointerEvents,
    }
  })
  console.log(`[GEOM] ${JSON.stringify(geom)}`)
  check('秦字与圆环同心（偏差 ≤ 2px）', Math.abs(geom.dx) <= 2 && Math.abs(geom.dy) <= 2, `${geom.dx},${geom.dy}`)
  check('圆环完整落在始皇帝背景范围内', geom.inside)

  await sleep(600)
  const entryVisible = await page.evaluate(() => {
    const el = document.querySelector('.qin-entry')
    if (!el) return { exists: false, opacity: 0 }
    return { exists: true, opacity: Number(getComputedStyle(el).opacity) }
  })
  console.log(`[ENTRY] ${JSON.stringify(entryVisible)}`)
  check('秦字转红后入口卡片才浮现且完全可见', entryVisible.exists && entryVisible.opacity >= 0.95, `${entryVisible.opacity}`)
  check(
    '终章后地图层不再响应指针（回退只走底部节点）',
    geom.svgPointer === 'none' && geom.regionPointer === 'none',
    `${geom.svgPointer}/${geom.regionPointer}`,
  )
  // 终章后悬浮底部节点，不能反过来点亮已经退场的地图
  await page.hover('.rail-node:nth-child(4)') // 魏
  await sleep(350)
  const railHoverAfterUnify = await page.evaluate(() => ({
    tip: Boolean(document.querySelector('.map-tip')),
    regionHovered: document.querySelectorAll('.region.is-hovered').length,
    nodeHovered: document.querySelectorAll('.rail-node.is-hovered').length,
  }))
  console.log(`[RAIL-AFTER] ${JSON.stringify(railHoverAfterUnify)}`)
  check('终章后悬浮节点不再弹出地图提示卡', !railHoverAfterUnify.tip)
  check('终章后悬浮节点不再高亮地图图块', railHoverAfterUnify.regionHovered === 0, `${railHoverAfterUnify.regionHovered}`)
  check('终章后节点自身的流光仍正常', railHoverAfterUnify.nodeHovered === 1, `${railHoverAfterUnify.nodeHovered}`)
  await page.screenshot({ path: `${OUT}\\02b-unified.png` })

  /* ---------- 3c) 点「齐」先出战报，关掉战报才演终章 ---------- */
  await page.evaluate(() => document.querySelectorAll('.rail-node')[5].click()) // 回到 index 5
  await sleep(900)
  const qiBox = await page.evaluate(() => {
    const el = document.querySelector('[data-nation="qi"] .region-base')
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  await openReportByClick(qiBox)
  await sleep(1000)
  const atSix = await page.evaluate(() => ({
    index: document.querySelector('.endgame-page')?.getAttribute('data-index'),
    hasPanel: Boolean(document.querySelector('.battle-panel')),
    hasHero: Boolean(document.querySelector('.unify-hero')),
    hasEntry: Boolean(document.querySelector('.qin-entry')),
    unified: document.querySelector('.map-stage')?.getAttribute('data-unified'),
  }))
  console.log(`[SIX-OPEN] ${JSON.stringify(atSix)}`)
  check('点「齐」后 index 到 6 且战报打开', atSix.index === '6' && atSix.hasPanel)
  check('战报打开时不出现大秦入口', !atSix.hasEntry, `entry=${atSix.hasEntry}`)
  check('战报打开时不播终章', !atSix.hasHero && atSix.unified === 'false', `unified=${atSix.unified}`)

  await page.evaluate(() => {
    document.querySelector('.map-bg').dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await sleep(500)
  const afterClose = await page.evaluate(() => ({
    hasPanel: Boolean(document.querySelector('.battle-panel')),
    hasHero: Boolean(document.querySelector('.unify-hero')),
  }))
  console.log(`[SIX-CLOSED] ${JSON.stringify(afterClose)}`)
  check('关闭战报后才出现终章秦字', !afterClose.hasPanel && afterClose.hasHero)


  // 降噪后灭国不再填充底色，进攻判据改为"国名是否消散"
  const labelOf = (nation) =>
    page.evaluate((id) => {
      const el = document.querySelector(`[data-nation="${id}"] .region-label`)
      if (!el) return null
      return Number(Number(getComputedStyle(el).opacity).toFixed(2))
    }, nation)

  const beforeBack = { wei: await labelOf('wei'), chu: await labelOf('chu'), qi: await labelOf('qi') }
  await page.evaluate(() => document.querySelectorAll('.rail-node')[2].click()) // → index 2
  await sleep(1100)
  const back = await page.evaluate(() => ({
    index: document.querySelector('.endgame-page')?.getAttribute('data-index'),
    captured: document.querySelectorAll('.region.is-captured').length,
    hasEntry: Boolean(document.querySelector('.qin-entry')),
    hasPanel: Boolean(document.querySelector('.battle-panel')),
  }))
  const afterBack = { wei: await labelOf('wei'), chu: await labelOf('chu'), qi: await labelOf('qi') }
  console.log(
    `\n[BACK] ${JSON.stringify(back)} · 国名可见度 ${Object.values(beforeBack).join('/')} → ${Object.values(afterBack).join('/')}`,
  )
  check('回退到 index 2', back.index === '2', back.index)
  check('已入秦图的只剩 3 个（秦+韩+赵）', back.captured === 3, `${back.captured}`)
  check('秦朝入口消失', !back.hasEntry)
  check('回退后仍无战报栏', !back.hasPanel)
  check(
    '回退后六国国名随之复原',
    Object.values(beforeBack).every((v) => v < 0.05) && Object.values(afterBack).every((v) => v > 0.5),
    `${Object.values(beforeBack).join('/')} → ${Object.values(afterBack).join('/')}`,
  )

  // 秦字应落在「秦 + 已灭诸国」合并后的重心，而不是固定在某处
  const qinShift = await page.evaluate(() => {
    const el = document.querySelector('.region-label--qin')
    return getComputedStyle(el).transform
  })
  check(
    '秦字移到合并疆域重心',
    qinShift !== 'none' && !/matrix\(1, 0, 0, 1, 0, 0\)/.test(qinShift),
    qinShift,
  )

  /* ---------- 3d) 已灭国的原疆域可悬浮点亮 ---------- */
  const hanBox = await page.evaluate(() => {
    const el = document.querySelector('[data-nation="han"] .region-base')
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  const hanEdgeIdle = await page.evaluate(() => {
    const edge = document.querySelector('[data-nation="han"] .region-edge')
    return Number(getComputedStyle(edge).opacity)
  })
  await page.mouse.move(hanBox.x, hanBox.y, { steps: 3 })
  await sleep(500)
  const hanHover = await page.evaluate(() => {
    const edge = document.querySelector('[data-nation="han"] .region-edge')
    const cs = getComputedStyle(edge)
    return {
      opacity: Number(cs.opacity),
      stroke: cs.stroke,
      width: Number(cs.strokeWidth.replace('px', '')),
      tip: Boolean(document.querySelector('.map-tip')),
    }
  })
  console.log(`[HAN-EDGE] idle=${hanEdgeIdle} hover=${JSON.stringify(hanHover)}`)
  check('已灭国平时无国界（opacity 0）', hanEdgeIdle < 0.1, `${hanEdgeIdle}`)
  check('悬浮已灭国时原疆域描边点亮', hanHover.opacity > 0.9, `${hanHover.opacity}`)
  check('点亮后为鎏金描边且加粗', /goldStroke/.test(hanHover.stroke) && hanHover.width >= 2.5, `${hanHover.stroke} · ${hanHover.width}px`)
  check('悬浮已灭国仍给出提示卡', hanHover.tip)
  await page.screenshot({ path: `${OUT}\\03b-conquered-hover.png` })
  await page.mouse.move(800, 120, { steps: 2 })
  await sleep(300)

  /* ---------- 3e) 点「秦」回到战前 ---------- */
  const qinBox = await page.evaluate(() => {
    const el = document.querySelector('[data-nation="qin"] .region-base')
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  await page.mouse.move(qinBox.x, qinBox.y, { steps: 3 })
  await sleep(450)
  const qinTip = await page.evaluate(() => ({
    tip: Boolean(document.querySelector('.map-tip.is-qin-tip')),
    text: document.querySelector('.map-tip.is-qin-tip')?.textContent?.replace(/\s+/g, ' ').trim(),
  }))
  console.log(`[QIN-TIP] ${JSON.stringify(qinTip)}`)
  check('悬浮「秦」给出回战前提示', qinTip.tip && /回到战前/.test(qinTip.text ?? ''), qinTip.text)

  await page.mouse.click(qinBox.x, qinBox.y)
  await sleep(1000)
  const afterReset = await page.evaluate(() => ({
    index: document.querySelector('.endgame-page')?.getAttribute('data-index'),
    captured: document.querySelectorAll('.region.is-captured').length,
    labels: [...document.querySelectorAll('.region:not(.is-qin) .region-label')].filter(
      (n) => Number(getComputedStyle(n).opacity) > 0.5,
    ).length,
    entry: Boolean(document.querySelector('.qin-entry')),
    panel: Boolean(document.querySelector('.battle-panel')),
  }))
  console.log(`[RESET] ${JSON.stringify(afterReset)}`)
  check('点「秦」回到战前（index 0）', afterReset.index === '0', afterReset.index)
  check('六国恢复独立（只剩秦为墨色）', afterReset.captured === 1, `${afterReset.captured}`)
  check('六国国名重新显现', afterReset.labels === 6, `${afterReset.labels}/6`)
  check('秦朝入口与战报一并消失', !afterReset.entry && !afterReset.panel)

  // 后续用例依赖 index 2 的状态，复位回去
  await page.evaluate(() => document.querySelectorAll('.rail-node')[2].click())
  await sleep(900)
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
  await openReportByClick(zhaoBox)
  await sleep(900)
  const panel = await page.evaluate(() => {
    const sections = [...document.querySelectorAll('.battle-section')].map((n) => ({
      label: n.querySelector('.battle-section-label')?.textContent?.trim(),
      len: (n.querySelector('.battle-text')?.textContent ?? '').trim().length,
    }))
    const map = document.querySelector('.regions-layer')
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
  check('聚焦时整层压暗（地色+国名+国都）', panel.mapOpacity <= 0.35, `层透明度=${panel.mapOpacity}`)

  // 「秦」字要区别于其他国名：仍是金色，只是暗一档
  const qinLabel = await page.evaluate(() => {
    const el = document.querySelector('.region-label--qin')
    const layer = el?.parentElement
    return {
      fill: el ? getComputedStyle(el).fill : null,
      layerOpacity: layer ? Number(getComputedStyle(layer).opacity) : null,
      inDimmedLayer: Boolean(el?.closest('.regions-layer')),
    }
  })
  console.log(`[QIN-LABEL] ${JSON.stringify(qinLabel)}`)
  check('聚焦时秦字仍为金色', /233,\s*210,\s*154/.test(qinLabel.fill ?? ''), qinLabel.fill)
  check(
    '秦字未被灰化层吞掉（不在压暗组内）',
    qinLabel.inDimmedLayer === false,
    `inDimmedLayer=${qinLabel.inDimmedLayer}`,
  )
  check(
    '秦字亮度高于其他国名（>0.26 层透明度）',
    (qinLabel.layerOpacity ?? 0) > 0.35,
    `${qinLabel.layerOpacity}`,
  )
  check('正文人物被高亮为可点击标签', panel.figureTags >= 1, `${panel.figureTags}`)

  await page.screenshot({ path: `${OUT}\\04-detail.png` })
  /* ---------- 5b) 史料原文 ---------- */
  const quote = await page.evaluate(() => {
    const text = document.querySelector('.source-text')
    const panel = document.querySelector('.battle-panel')
    const tipEl = document.querySelector('.source-tooltip')
    const cs = text ? getComputedStyle(text) : null
    return {
      exists: Boolean(document.querySelector('.source-quote')),
      book: document.querySelector('.source-book-name')?.textContent?.trim(),
      mode: cs?.writingMode,
      font: cs ? cs.fontFamily : null,
      fits: panel.scrollHeight <= panel.clientHeight + 2,
      tipOpacity: tipEl ? Number(getComputedStyle(tipEl).opacity) : null,
    }
  })
  console.log(`[QUOTE] ${JSON.stringify(quote)}`)
  check('战报含史料原文模块', quote.exists && /史记/.test(quote.book ?? ''), quote.book)
  check('原文竖排（vertical-rl）', quote.mode === 'vertical-rl', quote.mode)
  check('原文使用楷体', /KaiTi|楷体|STKaiti/.test(quote.font ?? ''), quote.font)
  check('战报无需纵向滚动（一屏放得下）', quote.fits)
  check('今译默认隐藏', (quote.tipOpacity ?? 1) < 0.1, `${quote.tipOpacity}`)

  const qbox = await page.evaluate(() => {
    const r = document.querySelector('.source-text').getBoundingClientRect()
    return { x: r.x + 16, y: r.y + 30 }
  })
  await page.mouse.move(qbox.x, qbox.y, { steps: 3 })
  await sleep(500)
  const tip = await page.evaluate(() => {
    const el = document.querySelector('.source-tooltip')
    return {
      opacity: Number(getComputedStyle(el).opacity),
      text: el.textContent.replace(/\s+/g, ' ').trim(),
    }
  })
  console.log(`[TIP] ${tip.text.slice(0, 30)}`)
  check('悬浮原文浮出今译', tip.opacity >= 0.9, `${tip.opacity}`)
  check('今译有实质内容', tip.text.length > 20, `${tip.text.length} 字`)
  await page.mouse.move(800, 60, { steps: 2 })
  await sleep(300)

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
    mapOpacity: Number(getComputedStyle(document.querySelector('.map-svg')).opacity),
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
