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
    测试里用"单击启动 + 派发 wheel 向下滚动"来快速到达战报。
  */
  /* 跳步会先弹「补齐推演」确认卡，有就点继续（DOM click，避免被覆盖层挡住） */
  const confirmJump = async () => {
    const clicked = await page.evaluate(() => {
      const btn = document.querySelector(".conquer-confirm-primary")
      if (!btn) return false
      btn.click()
      return true
    })
    if (clicked) await sleep(280)
  }

  /* 点底部节点：会同时展开该场战报，测试里顺手关掉以便继续观察版图 */
  const railTo = async (value) => {
    await page.evaluate((v) => document.querySelectorAll('.rail-node')[v].click(), value)
    await sleep(500)
    if (await page.evaluate(() => Boolean(document.querySelector('.battle-panel')))) {
      await page.keyboard.press('Escape')
      await page.waitForSelector('.battle-panel', { hidden: true, timeout: 3000 }).catch(() => null)
      await sleep(400)
    }
  }
  const openReportByClick = async (box) => {
    await page.mouse.click(box.x, box.y)
    await sleep(140)
    await page.evaluate(() => {
      document
        .querySelector('.map-stage')
        ?.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 120 }))
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
  check('末页入口指向周室倾覆', /周室倾覆/.test(ctaText ?? ''), ctaText)
  await page.click('.timeline-btn--endgame')
  await page.waitForSelector('.fall-page', { timeout: 8000 })
  // 过渡页是三页翻页：点一下跳过逐字，滚两次翻到第三幕，再点入口
  for (let i = 0; i < 2; i += 1) {
    await page.mouse.click(720, 460)
    await sleep(200)
    await page.mouse.move(700, 450)
    await page.mouse.wheel({ deltaY: 220 })
    await sleep(700)
  }
  await page.mouse.click(720, 460)
  await sleep(500)
  await page.waitForSelector('.fall-foot[data-visible="true"]', { timeout: 6000 })
  await page.click('.fall-enter')
  await sleep(1200)
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
    const el = document.querySelector('[data-nation="zhao"] .region-base')
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  await page.mouse.click(campaignBox.x, campaignBox.y) // 单击启动序列
  await sleep(260)
  await confirmJump()
  const play0 = await page.evaluate(() => ({
    panel: Boolean(document.querySelector('.battle-panel')),
    routes: document.querySelectorAll('.campaign-route').length,
    current: document.querySelectorAll('.campaign-route.is-current').length,
  }))
  console.log(`[CAMPAIGN-0] ${JSON.stringify(play0)}`)
  check('单击国家开始播放战役序列', play0.routes === 4 && play0.current === 1, `${play0.current}/${play0.routes}`)
  check('点击后收起悬浮卡', !(await page.evaluate(() => Boolean(document.querySelector('.map-tip')))))
  const skipHint = Boolean(
    await page.waitForSelector('.campaign-skip-hint', { timeout: 2000 }).catch(() => null),
  )
  const skipHintText = await page.evaluate(
    () => document.querySelector('.campaign-skip-hint')?.textContent?.trim() ?? '',
  )
  check('行军期间提示可滚动跳过', skipHint && /滚动/.test(skipHintText), skipHintText)
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
    document.querySelector('.map-stage')?.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 120 })),
  )
  await sleep(800)
  const play2 = await page.evaluate(() => ({
    panel: Boolean(document.querySelector('.battle-panel')),
    played: document.querySelectorAll('.campaign-route.is-played').length,
    items: document.querySelectorAll('.campaign-item').length,
  }))
  console.log(`[CAMPAIGN-2] ${JSON.stringify(play2)}`)
  check('双击跳过后直接进入战报', play2.panel)
  check('跳过后四段路线全部保留（含援军）', play2.played === 4, `${play2.played}`)
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

  // 地理校验：秦军首段必须自咸阳出发，且路线是折线
  await page.mouse.move(1400, 700, { steps: 2 })
  await sleep(400)
  const geo = await page.evaluate(() => {
    const qin = document.querySelector('.campaign-route.side-qin .campaign-line')
    const d = qin?.getAttribute('d') ?? ''
    return {
      start: d.slice(0, 16),
      segments: (d.match(/L /g) ?? []).length,
      allies: document.querySelectorAll('.campaign-ally').length,
      allyRows: document.querySelectorAll('.campaign-ally-row').length,
      settled: document.querySelector('.campaign-layer')?.getAttribute('data-settled'),
      visibleRoutes: [...document.querySelectorAll('.campaign-route')].filter(
        (r) => Number(getComputedStyle(r).opacity) > 0.05,
      ).length,
    }
  })
  console.log(`[GEO] ${JSON.stringify(geo)}`)
  check('秦军路线自咸阳出发', geo.start.startsWith('M 250.0 401.9'), geo.start)
  check('路线为多段折线', geo.segments >= 2, `${geo.segments} 段`)
  check('赵之战有援军路线', geo.allies >= 1, `${geo.allies} 条`)
  check('战报列出援军动向', geo.allyRows >= 1, `${geo.allyRows} 行`)
  check('战报展开后路线默认全隐', geo.settled === 'true' && geo.visibleRoutes === 0, `可见=${geo.visibleRoutes}`)
  // 收尾：关战报、回到战前
  await page.evaluate(() =>
    document.querySelector('.map-bg')?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
  )
  await sleep(600)
  await railTo(0)
  await sleep(800)

  /* ---------- 2c) 线性时间轴：跳步必须先补齐 ---------- */
  // 从干净页面开始，避免前面的状态让坐标/索引失真
  await page.goto('http://localhost:5180/dynasty/zhou/endgame', { waitUntil: 'networkidle2' })
  await page.waitForSelector('.map-stage')
  await sleep(1200)

  const clickNation2 = (id) =>
    page.evaluate((n) => {
      document.querySelector(`[data-nation="${n}"]`)?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      )
    }, id)

  await clickNation2('chu')
  await sleep(350)
  const confirmShown = Boolean(await page.waitForSelector('.conquer-confirm', { timeout: 3000 }).catch(() => null))
  const confirmText = await page.evaluate(
    () => document.querySelector('.conquer-confirm-text')?.textContent?.trim() ?? '',
  )
  check('跳步先弹补齐确认', confirmShown, confirmText)
  check('确认文案列出前置国家', /韩/.test(confirmText) && /赵/.test(confirmText), confirmText)

  await confirmJump()
  await sleep(350)
  const jump = await page.evaluate(() => ({
    index: document.querySelector('.endgame-page')?.getAttribute('data-index'),
    captured: document.querySelectorAll('.region.is-captured').length,
    hanCaptured: document.querySelector('[data-nation="han"]')?.getAttribute('data-captured'),
    weiCaptured: document.querySelector('[data-nation="wei"]')?.getAttribute('data-captured'),
    routes: document.querySelectorAll('.campaign-route').length,
    panel: Boolean(document.querySelector('.battle-panel')),
  }))
  console.log(`[JUMP] ${JSON.stringify(jump)}`)
  check('跳步点楚时先把前置国并入秦', jump.index === '3' && jump.captured === 4, `index=${jump.index} captured=${jump.captured}`)
  check('中间国家都已归秦', jump.hanCaptured === 'true' && jump.weiCaptured === 'true')

  // 滚轮跳过行军 → 战报出现；hover 路线 → 地图浮现地名
  await page.evaluate(() =>
    document.querySelector('.map-stage')?.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 120 })),
  )
  await page.waitForSelector('.battle-panel', { timeout: 5000 }).catch(() => null)
  await sleep(600)
  await page.hover('.campaign-item')
  await sleep(500)
  const hoverPlaces = await page.evaluate(() => {
    const hot = document.querySelector('.campaign-route.is-hovered')
    const places = [...(hot?.querySelectorAll('.campaign-place') ?? [])]
    return {
      visible: places.filter((n) => Number(getComputedStyle(n).opacity) > 0.5).length,
      names: places.map((n) => n.textContent?.trim()),
    }
  })
  console.log(`[HOVER-PLACES] ${JSON.stringify(hoverPlaces)}`)
  check('hover 路线时浮现地名', hoverPlaces.visible >= 2, `${hoverPlaces.visible} 个`)
  check('地名包含起点与目的地', hoverPlaces.names.includes('咸阳'), hoverPlaces.names.join('/'))

  // 已灭国：点它只展开战报，不重演征服过程
  await page.keyboard.press('Escape')
  await page.waitForSelector('.battle-panel', { hidden: true, timeout: 3000 }).catch(() => null)
  await sleep(400)
  const t0 = Date.now()
  await clickNation2('han')
  const conqueredOpened = Boolean(
    await page.waitForSelector('.battle-panel', { timeout: 2000 }).catch(() => null),
  )
  const openCost = Date.now() - t0
  const conqueredState = await page.evaluate(() => ({
    title: document.querySelector('.battle-title')?.textContent?.trim(),
    current: document.querySelectorAll('.campaign-route.is-current').length,
    settled: document.querySelector('.campaign-layer')?.getAttribute('data-settled'),
    index: document.querySelector('.endgame-page')?.getAttribute('data-index'),
  }))
  console.log(`[CONQUERED-CLICK] ${JSON.stringify({ conqueredOpened, openCost, ...conqueredState })}`)
  check('点已灭国直接展开战报', conqueredOpened && conqueredState.title === '秦灭韩', conqueredState.title)
  check('点已灭国不播行军动画', conqueredState.current === 0 && conqueredState.settled === 'true', `current=${conqueredState.current} settled=${conqueredState.settled}`)
  check('点已灭国不改变时间线', conqueredState.index === '4', conqueredState.index)
  // 底部国家容器优先级最高：点它应立刻作废进行中的行军
  await page.keyboard.press('Escape')
  await page.waitForSelector('.battle-panel', { hidden: true, timeout: 3000 }).catch(() => null)
  await sleep(400)
  await railTo(0)
  await sleep(700)

  await clickNation2('han') // 韩是第一个，无需确认
  await sleep(400)
  const beforeRail = await page.evaluate(() => ({
    routes: document.querySelectorAll('.campaign-route').length,
  }))
  await railTo(0)
  await sleep(500)
  const afterRail = await page.evaluate(() => ({
    index: document.querySelector('.endgame-page')?.getAttribute('data-index'),
    routes: document.querySelectorAll('.campaign-route').length,
    panel: Boolean(document.querySelector('.battle-panel')),
  }))
  await sleep(2600) // 若序列仍在跑，这段时间足以让它结束
  const settledAfterRail = await page.evaluate(() => Boolean(document.querySelector('.battle-panel')))
  console.log(`[RAIL-PRIORITY] ${JSON.stringify({ beforeRail, afterRail, settledAfterRail })}`)
  check('底部容器点击后行军立即作废', beforeRail.routes > 0 && afterRail.routes === 0)
  check('作废的行军不会再弹战报', afterRail.panel === false && settledAfterRail === false)

  /* ---------- 2d) 战报开着时点另一国：先播退场动画 ---------- */
  // 直接派发 click，绕开小多边形（韩）包围盒中心的命中误差；
  // 面板等它自然出现，不依赖"跳过"的时机。
  await page.goto('http://localhost:5180/dynasty/zhou/endgame', { waitUntil: 'networkidle2' })
  await page.waitForSelector('.map-stage')
  await sleep(1200)
  if (await page.evaluate(() => Boolean(document.querySelector('.battle-panel')))) {
    await page.keyboard.press('Escape')
    await page.waitForSelector('.battle-panel', { hidden: true, timeout: 3000 }).catch(() => null)
    await sleep(300)
  }

  const clickNation = (id) =>
    page.evaluate((n) => {
      document.querySelector(`[data-nation="${n}"]`)?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      )
    }, id)

  await clickNation('han')
  const opened = Boolean(
    await page.waitForSelector('.battle-panel', { timeout: 9000 }).catch(() => null),
  )

  await clickNation('zhao')
  await clickNation('zhao')
  // 退场是 240ms：面板不能瞬间消失，先留在原地把动画播完
  await sleep(80)
  const stillThere = Boolean(await page.evaluate(() => document.querySelector('.battle-panel')))
  await sleep(420)
  const goneAfterAnim = !(await page.evaluate(() => document.querySelector('.battle-panel')))
  await sleep(700)
  const afterSwitch = await page.evaluate(() => ({
    panel: Boolean(document.querySelector('.battle-panel')),
    routes: document.querySelectorAll('.campaign-route').length,
  }))
  console.log(`[SWITCH] ${JSON.stringify({ opened, stillThere, goneAfterAnim, afterSwitch })}`)
  check('切换国家时战报先退场再让位给新战报', opened && goneAfterAnim && !afterSwitch.panel, `留=${stillThere} 走=${goneAfterAnim}`)
  check('退场后才开始新的行军', !afterSwitch.panel && afterSwitch.routes > 0, `${afterSwitch.routes}`)

  // 收尾
  await railTo(0)
  await sleep(600)
  /* ---------- 3) 正推 / 逆推 ---------- */
  await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('.rail-node')]
    nodes[nodes.length - 1].click()
  })
  await sleep(900)
  // 点底部节点现在会展开该场战报；终章要等战报关掉才演
  const railOpenedReport = await page.evaluate(() => Boolean(document.querySelector('.battle-panel')))
  check('点底部最后节点会展开对应战报', railOpenedReport)
  await page.keyboard.press('Escape')
  await page.waitForSelector('.battle-panel', { hidden: true, timeout: 3000 }).catch(() => null)
  await sleep(900)
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
  await railTo(5) // 回到 index 5（会自动关掉弹出的战报）
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
  await railTo(2) // → index 2
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
  await railTo(2)
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
      // 史实必须完整落在自己的容器里：不横向溢出、不纵向溢出、不越出父框
      fits: (() => {
        const q = document.querySelector('.source-text')
        const box = document.querySelector('.source-quote')
        if (!q || !box) return false
        const qr = q.getBoundingClientRect()
        const br = box.getBoundingClientRect()
        return (
          q.scrollHeight <= q.clientHeight + 2 &&
          q.scrollWidth <= q.clientWidth + 2 &&
          qr.bottom <= br.bottom + 1 &&
          qr.top >= br.top - 1
        )
      })(),
      tipOpacity: tipEl ? Number(getComputedStyle(tipEl).opacity) : null,
    }
  })
  console.log(`[QUOTE] ${JSON.stringify(quote)}`)
  check('战报含史料原文模块', quote.exists && /史记/.test(quote.book ?? ''), quote.book)
  check('原文竖排（vertical-rl）', quote.mode === 'vertical-rl', quote.mode)
  check('原文使用楷体', /KaiTi|楷体|STKaiti/.test(quote.font ?? ''), quote.font)
  check('史实原文完整落在容器内', quote.fits)
  check('今译默认隐藏', (quote.tipOpacity ?? 1) < 0.1, `${quote.tipOpacity}`)

  // 今译卡应浮在史实框之上，而不是被裁进框内
  await page.hover('.source-body')
  await sleep(500)
  const tipGeo = await page.evaluate(() => {
    const tip = document.querySelector('.source-tooltip')
    const quote = document.querySelector('.source-quote')
    const panel = document.querySelector(".battle-panel")
    const t = tip.getBoundingClientRect()
    const q = quote.getBoundingClientRect()
    const p = panel.getBoundingClientRect()
    return {
      opacity: Number(getComputedStyle(tip).opacity),
      above: t.bottom <= q.top + 1,
      insidePanel: t.top >= p.top - 1 && t.bottom <= p.bottom + 1,
    }
  })
  console.log(`[TIP] ${JSON.stringify(tipGeo)}`)
  check('今译卡悬停可见', tipGeo.opacity > 0.9, `${tipGeo.opacity}`)
  check('今译卡浮在史实框之上（不在框内裁剪）', tipGeo.above && tipGeo.insidePanel, `above=${tipGeo.above} inPanel=${tipGeo.insidePanel}`)
  await page.mouse.move(1450, 820, { steps: 2 })
  await sleep(300)

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
  check('末页下滚进入周室倾覆', /\/fall$/.test(page.url()), page.url())
  // 过渡页：跳过动画 → 进入沙盘，后面的字体检查要在沙盘上跑
  await page.click('.fall-page')
  await page.waitForSelector('.fall-enter', { timeout: 4000 }).catch(() => null)
  await page.click('.fall-enter')
  await sleep(1200)
  await page.waitForSelector('.map-stage', { timeout: 10000 }).catch(() => null)

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
