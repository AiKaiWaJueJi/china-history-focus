/**
 * verify-journey.mjs —— 全链路「像用户一样走一遍」的冒烟验收
 * ===========================================================================
 * 其它脚本各自守一个局部（时间轴 / 过渡页 / 沙盘 / 抽屉），这套守的是**串起来**：
 *
 *   1. 主页 12 个模块 → 点进任意一朝 → 翻完该朝所有页 → ESC 回主页；
 *   2. 22 章过渡页：三幕逐字 → 下滚推进 → 入口浮出 → 点进去落点正确；
 *   3. 12 盘沙盘：地图 / 国都 / 阶梯节点 → 点国 → 战报 → 史料抽屉 → 下钻 → ESC；
 *   4. 全程记录 pageerror / console error / 失败请求，**一条都不许有**。
 *
 * 与逐条断言脚本的分工：这里允许"宽而浅"，但每一条失败都对应一个真实用户会撞到的路口。
 * 用法：node verify-journey.mjs（需要 dev server；APP_URL 可覆盖）
 */
import puppeteer from 'puppeteer-core'
import { mkdirSync, readFileSync } from 'node:fs'
import { clickRailNode } from './scripts/lib/verify-rail.mjs'

const BASE = process.env.APP_URL ?? 'http://localhost:5180'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const SHOTS = 'shots/journey'
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
mkdirSync(SHOTS, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, pass: Boolean(ok) })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' :: ' + detail : ''}`)
}

/* 全程的异常池：每条带 route，方便定位是哪一屏 */
let route = '(boot)'
const issues = []

const DYNASTIES = [
  { id: 'zhou', name: '周', kind: 'normal' },
  { id: 'qin', name: '秦', kind: 'normal' },
  { id: 'han', name: '漢', kind: 'normal' },
  { id: 'jin', name: '晋', kind: 'normal' },
  { id: 'southern_northern', name: '南北朝', kind: 'nanbei' },
  { id: 'sui', name: '隋', kind: 'normal' },
  { id: 'tang', name: '唐', kind: 'normal' },
  { id: 'five_dynasties', name: '五代', kind: 'wudai' }, // 主页展签上写「五代」
  { id: 'song', name: '宋', kind: 'normal' },
  { id: 'yuan', name: '元', kind: 'normal' },
  { id: 'ming', name: '明', kind: 'normal' },
  { id: 'qing', name: '清', kind: 'normal' },
]

/** 22 章过渡页：期望标题 + 演完的落点 */
const FALLS = [
  { dynasty: 'zhou', chapter: null, title: '九鼎入秦', next: 'endgame' },
  { dynasty: 'zhou', chapter: 'dongqian', title: '平王东迁', next: 'timeline' },
  { dynasty: 'qin', chapter: null, title: '二世而亡', next: 'endgame' },
  { dynasty: 'han', chapter: null, title: '漢魏禅代', next: 'endgame' },
  { dynasty: 'han', chapter: 'xin', title: '王莽篡漢', next: 'timeline' },
  { dynasty: 'han', chapter: 'zhongxing', title: '光武中兴', next: 'timeline' },
  { dynasty: 'jin', chapter: null, title: '晋宋禅代', next: 'endgame' },
  { dynasty: 'jin', chapter: 'yongjia', title: '永嘉南渡', next: 'timeline' },
  { dynasty: 'southern_northern', chapter: 'n439', title: '北魏统一北方', next: 'timeline' },
  { dynasty: 'southern_northern', chapter: 'n479', title: '刘宋灭亡 · 萧齐代之', next: 'timeline' },
  { dynasty: 'southern_northern', chapter: 'n502', title: '萧齐灭亡 · 萧梁代之', next: 'timeline' },
  { dynasty: 'southern_northern', chapter: 'n534', title: '北魏分裂', next: 'timeline' },
  { dynasty: 'southern_northern', chapter: 'n550', title: '东魏灭亡 · 北齐代之', next: 'timeline' },
  { dynasty: 'southern_northern', chapter: 'n557', title: '梁亡陈立 · 周代西魏', next: 'timeline' },
  { dynasty: 'southern_northern', chapter: 'n577', title: '北周灭北齐', next: 'timeline' },
  { dynasty: 'southern_northern', chapter: 'n589', title: '隋灭陈 · 南北朝终', next: 'endgame' },
  { dynasty: 'sui', chapter: null, title: '江都之变', next: 'endgame' },
  { dynasty: 'tang', chapter: null, title: '唐亡', next: 'endgame' },
  { dynasty: 'tang', chapter: 'wuzhou', title: '武周革命', next: 'timeline' },
  { dynasty: 'tang', chapter: 'shenlong', title: '神龙复唐', next: 'timeline' },
  { dynasty: 'five_dynasties', chapter: null, title: '陈桥兵变', next: 'endgame' },
  { dynasty: 'five_dynasties', chapter: 'houtang', title: '后唐灭梁', next: 'timeline' },
  { dynasty: 'five_dynasties', chapter: 'shijin', title: '石晋代唐', next: 'timeline' },
  { dynasty: 'five_dynasties', chapter: 'qidan', title: '契丹灭晋', next: 'timeline' },
  { dynasty: 'five_dynasties', chapter: 'houzhou', title: '郭威建周', next: 'timeline' },
  { dynasty: 'song', chapter: null, title: '崖山', next: 'endgame' },
  { dynasty: 'song', chapter: 'jingkang', title: '靖康之变', next: 'timeline' },
  { dynasty: 'yuan', chapter: null, title: '元亡', next: 'endgame' },
  { dynasty: 'ming', chapter: null, title: '甲申之变', next: 'endgame' },
  { dynasty: 'qing', chapter: null, title: '清帝退位', next: 'endgame' },
  { dynasty: 'qing', chapter: 'ruquan', title: '入关定鼎', next: 'timeline' },
]

/** 12 盘沙盘里，谁不是「终章 → 下一朝」而是回主页 */
const ENDGAMES = [
  'zhou',
  'qin',
  'han',
  'jin',
  'southern_northern',
  'sui',
  'tang',
  'five_dynasties',
  'song',
  'yuan',
  'ming',
  'qing',
]

/** 朝代 → 沙盘数据文件（用来取「第一场战事打谁」，不然点错国家只会弹「补齐推演」） */
const ENDGAME_FILES = {
  zhou: 'endgame.zhou.json',
  qin: 'endgame.chuhan.json',
  han: 'endgame.han.json',
  southern_northern: 'endgame.nanbei.json',
  sui: 'endgame.sui.json',
  tang: 'endgame.tang.json',
  five_dynasties: 'endgame.five_dynasties.json',
  song: 'endgame.song.json',
  yuan: 'endgame.yuan.json',
  ming: 'endgame.ming.json',
  qing: 'endgame.qing.json',
}

const firstTarget = (id) => {
  const doc = readJson(`src/data/${ENDGAME_FILES[id]}`)
  const first = (doc.events ?? [])[0]
  return first?.nationId ?? null
}

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--no-sandbox', '--force-device-scale-factor=1'],
  defaultViewport: { width: 1440, height: 900 },
})

const page = await browser.newPage()
await page.setCacheEnabled(false)
page.on('pageerror', (e) => issues.push({ route, kind: 'pageerror', msg: String(e).slice(0, 220) }))
page.on('console', (m) => {
  if (m.type() === 'error') issues.push({ route, kind: 'console', msg: m.text().slice(0, 220) })
})
page.on('requestfailed', (r) => {
  const reason = r.failure()?.errorText ?? ''
  if (!reason.includes('ERR_ABORTED')) issues.push({ route, kind: 'requestfailed', msg: `${r.url().slice(0, 140)} ${reason}` })
})
page.on('response', (r) => {
  if (r.status() >= 400) issues.push({ route, kind: `http${r.status()}`, msg: r.url().slice(0, 140) })
})

const gotoRoute = async (path, ready) => {
  route = path
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle2', timeout: 60000 })
  if (ready) await page.waitForSelector(ready, { timeout: 20000 })
  await page.evaluate(() => document.fonts.ready).catch(() => null)
  await sleep(700)
}

/** 只报「本屏新增」的异常，避免一条错误算到后面所有路由头上 */
const noIssue = (label) => {
  const bad = issues.filter((i) => i.route === route)
  check(`${label}：无 JS 异常 / 资源 404`, bad.length === 0, bad.slice(0, 2).map((i) => `${i.kind} ${i.msg}`).join(' | '))
}

const centerOf = async (selector, index = 0) => {
  return page.evaluate(
    (sel, idx) => {
      const el = document.querySelectorAll(sel)[idx]
      if (!el) return null
      el.scrollIntoView({ block: 'center' })
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) return null
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    },
    selector,
    index,
  )
}

try {
  /* =========================================================================
   * 第 0 幕：主页
   * ======================================================================= */
  await gotoRoute('/', '.gallery')
  const gallery = await page.evaluate(() => ({
    panels: document.querySelectorAll('.dyn-panel').length,
    names: [...document.querySelectorAll('.dyn-name')].map((n) => n.textContent?.trim()),
    title: document.querySelector('.app-title')?.textContent?.trim(),
  }))
  console.log(`\n[主页] ${JSON.stringify(gallery)}`)
  check('主页 12 个朝代模块', gallery.panels === 12, `${gallery.panels} 个`)
  check(
    '朝代顺序正确（周→清）',
    gallery.names.join('') === '周秦漢晋南北朝隋唐五代宋元明清',
    gallery.names.join('/'),
  )

  /* 悬停挤压：鼠标移到中间模块，宽度应明显变宽 */
  const before = await page.evaluate(() => document.querySelectorAll('.dyn-panel')[6].getBoundingClientRect().width)
  const mid = await centerOf('.dyn-panel', 6)
  if (mid) await page.mouse.move(mid.x, mid.y)
  await sleep(650)
  const after = await page.evaluate(() => document.querySelectorAll('.dyn-panel')[6].getBoundingClientRect().width)
  check('悬停模块会挤压展开', after > before + 20, `${Math.round(before)} → ${Math.round(after)}`)
  check('主页没有横向滚动条（不溢出屏幕）', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
  await page.screenshot({ path: `${SHOTS}/00-gallery.png` })
  noIssue('主页')

  /* =========================================================================
   * 第 1 幕：12 朝时间轴 —— 逐个从主页点进去，翻完所有页，ESC 回来
   * ======================================================================= */
  console.log('\n—— 时间轴 12 朝 ——')
  for (const d of DYNASTIES) {
    route = `/dynasty/${d.id}`
    // 一律从主页用真实点击进入（验证「用户点得到」这件事本身）
    await gotoRoute('/', '.gallery')
    await page.evaluate((name) => {
      const panel = [...document.querySelectorAll('.dyn-panel')].find(
        (p) => p.querySelector('.dyn-name')?.textContent?.trim() === name,
      )
      panel?.click()
    }, d.name)
    await page.waitForFunction((id) => location.pathname === `/dynasty/${id}`, { timeout: 15000 }, d.id).catch(() => null)
    route = `/dynasty/${d.id}`
    const landed = await page.evaluate(() => location.pathname)
    if (landed !== `/dynasty/${d.id}`) {
      check(`点「${d.name}」能进时间轴`, false, `落在 ${landed}`)
      continue
    }

    const ready =
      d.kind === 'nanbei' ? '.nanbei' : d.kind === 'wudai' ? '.wdc-page' : '.timeline-page'
    await page.waitForSelector(ready, { timeout: 20000 })
    await page.evaluate(() => document.fonts.ready).catch(() => null)
    await sleep(900)

    const dotSel = d.kind === 'nanbei' ? '.nbc-dot' : d.kind === 'wudai' ? '.wdc-dot' : '.timeline-dot'
    const pageSig = d.kind === 'nanbei' ? '.nbc-slot' : d.kind === 'wudai' ? '.wdc-card' : '.emp-card'
    const dots = await page.evaluate((sel) => document.querySelectorAll(sel).length, dotSel)
    check(`「${d.name}」时间轴能打开`, dots > 0, `${dots} 页`)

    /* 逐页点过去：每页都要有内容（空页 = 用户看到一片空舞台） */
    const emptyPages = []
    for (let i = 0; i < dots; i += 1) {
      const box = await centerOf(dotSel, i)
      if (box) await page.mouse.click(box.x, box.y)
      await sleep(d.kind === 'nanbei' ? 900 : 620)
      const info = await page.evaluate(
        (sel) => ({
          items: document.querySelectorAll(sel).length,
          text: document.querySelector('.timeline-count, .nbc-foot-meta, .wdc-count')?.textContent?.trim() ?? '',
        }),
        pageSig,
      )
      if (info.items === 0) emptyPages.push(i + 1)
    }
    check(`「${d.name}」每一页都有内容（共 ${dots} 页）`, emptyPages.length === 0, `空页 ${emptyPages.join(',')}`)

    /* 末页入口：有收尾的朝代要给「继续下滑」，且文案不是空的 */
    const lastBtn = await page.evaluate(() => {
      const btn = document.querySelector('.timeline-btn--endgame, .wdc-btn--fall, .nbc-endgame')
      return btn ? btn.textContent?.replace(/\s+/g, ' ').trim() : null
    })
    check(`「${d.name}」末页有收尾入口文案`, Boolean(lastBtn && lastBtn.length > 2), lastBtn ?? '无')

    if (d.kind === 'normal' && d.id === 'zhou') {
      await page.screenshot({ path: `${SHOTS}/01-zhou-timeline.png` })
    }
    if (d.id === 'southern_northern') await page.screenshot({ path: `${SHOTS}/01-nanbei.png` })
    if (d.id === 'five_dynasties') await page.screenshot({ path: `${SHOTS}/01-wudai.png` })

    /* ESC 回主页 */
    await page.keyboard.press('Escape')
    await sleep(500)
    const back = await page.evaluate(() => location.pathname)
    check(`「${d.name}」ESC 能回主页`, back === '/', back)
    noIssue(`「${d.name}」时间轴`)
  }

  /* =========================================================================
   * 第 2 幕：22 章过渡页 —— 三幕推进 + 入口落点
   * ======================================================================= */
  console.log('\n—— 过渡页 22 章 ——')
  for (const f of FALLS) {
    const path = `/dynasty/${f.dynasty}/fall${f.chapter ? '/' + f.chapter : ''}`
    await gotoRoute(path, '.fall-page')
    const title = await page.evaluate(() => ({
      title: document.querySelector('.fall-brand-title')?.textContent?.trim() ?? '',
      acts: document.querySelectorAll('.fall-dot').length,
      noArt: document.querySelectorAll('.fall-act--no-art').length,
    }))
    check(`过渡页「${f.title}」标题正确`, title.title === f.title, `${title.title}`)
    check(`过渡页「${f.title}」三幕`, title.acts === 3, `${title.acts} 幕`)

    /* 真实用户动作：下滚推进两幕 → 点一下跳过打字 → 入口浮出 */
    await sleep(850) // 进入后 620ms 惯性保护
    for (let i = 0; i < 2; i += 1) {
      await page.mouse.move(700, 420)
      await page.mouse.wheel({ deltaY: 260 })
      await sleep(720)
    }
    await page.mouse.click(700, 430)
    const foot = await page
      .waitForSelector('.fall-foot[data-visible="true"]', { timeout: 8000 })
      .then(() => true)
      .catch(() => false)
    check(`过渡页「${f.title}」演完浮出入口`, foot)

    const art = await page.evaluate(() => {
      const img = document.querySelector('.fall-photo')
      return img ? { ok: img.naturalWidth > 0, w: img.naturalWidth } : { ok: false, w: 0 }
    })
    check(`过渡页「${f.title}」配图加载成功`, art.ok, `naturalWidth=${art.w}`)

    if (f.title === '九鼎入秦' || f.title === '武周革命') {
      await page.screenshot({ path: `${SHOTS}/02-fall-${f.title}.png` })
    }

    /* 点入口，验落点 */
    const enterText = await page.evaluate(() => document.querySelector('.fall-enter')?.textContent?.trim() ?? '')
    await page.click('.fall-enter')
    await sleep(1400)
    const after = await page.evaluate(() => location.pathname)
    const expect =
      f.next === 'endgame' ? `/dynasty/${f.dynasty}/endgame` : `/dynasty/${f.dynasty}`
    check(`过渡页「${f.title}」入口文案非空`, enterText.length > 2, enterText.replace(/\s+/g, ' '))
    check(`过渡页「${f.title}」点入口落点正确`, after.startsWith(expect), `${after}（期望 ${expect}…）`)
    noIssue(`过渡页「${f.title}」`)
  }

  /* =========================================================================
   * 第 3 幕：12 盘沙盘 —— 地图 / 国都 / 阶梯 / 战报 / 史料
   * ======================================================================= */
  console.log('\n—— 沙盘 12 盘 ——')
  for (const id of ENDGAMES) {
    const path = `/dynasty/${id}/endgame`
    await gotoRoute(path, id === 'jin' ? '.jin-chronicle' : '.map-stage')

    if (id === 'jin') {
      /* 晋是「势力变迁图」，不是灭国战：只有区域 + 阶梯 */
      const jc = await page.evaluate(() => ({
        regions: document.querySelectorAll('.jc-region').length,
        nodes: document.querySelectorAll('.jc-node').length,
        summary: document.querySelector('.jc-summary')?.textContent?.trim().slice(0, 40) ?? '',
      }))
      check('晋·十六国图有区域与阶梯', jc.regions > 10 && jc.nodes > 5, `${jc.regions} 区域 / ${jc.nodes} 幕`)
      await page.keyboard.press('ArrowRight')
      await sleep(700)
      const nextSummary = await page.evaluate(() => document.querySelector('.jc-summary')?.textContent?.trim().slice(0, 40) ?? '')
      check('晋·十六国图能逐幕推进', nextSummary !== jc.summary, `${jc.summary} → ${nextSummary}`)
      await page.screenshot({ path: `${SHOTS}/03-endgame-jin.png` })
      noIssue('晋·十六国图')
      continue
    }

    const idle = await page.evaluate(() => ({
      regions: document.querySelectorAll('.region').length,
      capitals: document.querySelectorAll('.capital-label').length,
      rails: document.querySelectorAll('.rail-node').length,
      panel: Boolean(document.querySelector('.battle-panel')),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    }))
    check(`沙盘「${id}」地图与国都`, idle.regions >= 4 && idle.capitals >= 2 && idle.rails >= 2, `${idle.regions} 区 / ${idle.capitals} 都 / ${idle.rails} 节点`)
    check(`沙盘「${id}」打开时没有战报栏（地图独占）`, !idle.panel)
    check(`沙盘「${id}」不横向溢出`, !idle.overflow)

    /*
      点「第一场战事的目标国」——就像用户按年份顺序点下去。
      刻意不去点后面的国家：那时会先弹「补齐推演」确认卡（设计如此，见 §9）。

      取点用「网格采样 + elementFromPoint」而不是包围盒中心：
      三秦、楚这种 L 形/斜条区域的几何中心经常落在邻国或空白处，
      按中心点会点空（这是脚本的坑，不是页面的）。
    */
    const nationId = firstTarget(id)
    const target = await page.evaluate((nid) => {
      const group = document.querySelector(`[data-nation="${nid}"]`)
      if (!group) return null
      const shape = group.querySelector('.region-base') ?? group
      const r = shape.getBoundingClientRect()
      if (r.width < 5 || r.height < 5) return null
      const box = r
      for (let i = 1; i <= 6; i += 1) {
        for (let j = 1; j <= 6; j += 1) {
          const x = box.x + (box.width * i) / 7
          const y = box.y + (box.height * j) / 7
          const el = document.elementFromPoint(x, y)
          if (el?.closest?.('[data-nation]') === group) return { x, y }
        }
      }
      return null
    }, nationId)
    let opened = false
    if (target) {
      await page.mouse.click(target.x, target.y)
      for (let i = 0; i < 16 && !opened; i += 1) {
        // 有确认卡就先确认（理论上第一场不该有，留着兜底）
        const confirmed = await page.evaluate(() => {
          const btn = document.querySelector('.conquer-confirm-primary')
          if (!btn) return false
          btn.click()
          return true
        })
        if (confirmed) await sleep(300)
        await page.evaluate(() =>
          document.querySelector('.map-stage')?.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 160 })),
        )
        await sleep(400)
        opened = await page.evaluate(() => Boolean(document.querySelector('.battle-panel')))
      }
    } else {
      check(`沙盘「${id}」能找到第一场战事的目标国`, false, nationId ?? '数据里没有 nationId')
    }
    const report = opened
      ? await page.evaluate(() => ({
          title: document.querySelector('.battle-title')?.textContent?.trim() ?? '',
          sections: [...document.querySelectorAll('.battle-section-label')].map((n) => n.textContent?.trim()),
          figures: document.querySelectorAll('.figure-tag, .figure-card').length,
        }))
      : null
    check(`沙盘「${id}」点政权能开战报`, opened && Boolean(report?.title), report?.title ?? '未打开')
    check(
      `沙盘「${id}」战报三段齐全`,
      Boolean(report) && ['战前形势', '战役经过', '结局'].every((s) => report.sections.includes(s)),
      report?.sections.join('/') ?? '',
    )

    if (opened) {
      /* 战报 → 史料抽屉 → 下钻一层 → ESC → ESC */
      const codexBtn = await page.$('.battle-codex')
      if (codexBtn) {
        await codexBtn.click()
        await sleep(800)
        const drawer = await page.evaluate(() => ({
          open: Boolean(document.querySelector('.codex-drawer')),
          name: document.querySelector('.codex-drawer .codex-name')?.textContent?.trim() ?? '',
          links: document.querySelectorAll('.codex-drawer .codex-link').length,
        }))
        check(`沙盘「${id}」战报能开史料抽屉`, drawer.open && drawer.name.length > 0, drawer.name)
        if (drawer.links > 0) {
          await page.evaluate(() => {
            document.querySelector('.codex-drawer .codex-link')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
          })
          await sleep(700)
          const drilled = await page.evaluate(() => ({
            open: Boolean(document.querySelector('.codex-drawer')),
            crumbs: document.querySelectorAll('.codex-drawer .codex-crumb').length,
          }))
          check(`沙盘「${id}」抽屉能下钻`, drilled.open && drilled.crumbs === 2, `${drilled.crumbs} 层`)
        }
        await page.keyboard.press('Escape')
        await sleep(500)
      } else {
        check(`沙盘「${id}」战报有「史料」按钮`, false, '找不到 .battle-codex')
      }
      await page.keyboard.press('Escape')
      await sleep(400)
    }

    if (id === 'zhou') await page.screenshot({ path: `${SHOTS}/03-endgame-zhou.png` })
    if (id === 'qing') await page.screenshot({ path: `${SHOTS}/03-endgame-qing.png` })
    noIssue(`沙盘「${id}」`)
  }

  /* =========================================================================
   * 第 4 幕：档案抽屉的三种入口（用户真正会点的三个地方）
   * ======================================================================= */
  console.log('\n—— 档案抽屉三入口 ——')
  route = '/dynasty/qin'
  await gotoRoute('/dynasty/qin', '.timeline-page')
  await page.waitForSelector('.emp-card', { timeout: 15000 })
  await sleep(900)

  /* 入口一：点帝王卡本身 → 下钻典制词条（这条曾经整页黑屏） */
  await page.evaluate(() => {
    const card = [...document.querySelectorAll('.emp-card')].find((c) => c.textContent?.includes('秦始皇'))
    card?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await sleep(700)
  const drawer1 = await page.evaluate(() => ({
    open: Boolean(document.querySelector('.codex-drawer')),
    name: document.querySelector('.codex-drawer .codex-name')?.textContent?.trim() ?? '',
    veil: getComputedStyle(document.querySelector('.codex-veil')).backgroundColor,
    shell: Number(getComputedStyle(document.querySelector('.app-shell')).opacity),
  }))
  check('点帝王卡能开抽屉', drawer1.open && drawer1.name === '秦始皇', drawer1.name)
  check('抽屉压暗但不遮黑（背景仍可见）', drawer1.shell > 0.3 && drawer1.shell < 0.7, `shell=${drawer1.shell} veil=${drawer1.veil}`)

  /* 入口一：点帝王卡本身 → 展开「书同文·车同轨」→ 点相关档案下钻（这条曾经整页黑屏） */
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('.codex-drawer .codex-event')].find((n) =>
      n.textContent?.includes('书同文'),
    )
    row?.click()
  })
  await sleep(400)
  await page.evaluate(() => {
    const link = [...document.querySelectorAll('.codex-drawer .codex-event-detail .codex-link')].find((n) =>
      n.textContent?.includes('书同文'),
    )
    link?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await sleep(800)
  const drawer2 = await page.evaluate(() => ({
    open: Boolean(document.querySelector('.codex-drawer')),
    name: document.querySelector('.codex-drawer .codex-name')?.textContent?.trim() ?? '',
    body: document.querySelector('.codex-drawer .codex-body')?.textContent?.trim().length ?? 0,
    crumbs: [...document.querySelectorAll('.codex-drawer .codex-crumb')].map((n) => n.textContent?.trim()),
    rootAlive: (document.getElementById('root')?.children.length ?? 0) > 0,
  }))
  check('档案里点「书同文」不再黑屏', drawer2.open && drawer2.rootAlive && drawer2.body > 40, `${drawer2.name} body=${drawer2.body}`)

  /* 面包屑跳级 + ← 键退一级 */
  await page.evaluate(() => {
    const crumb = [...document.querySelectorAll('.codex-drawer .codex-crumb')].find((n) => n.textContent?.trim() === '秦始皇')
    crumb?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await sleep(600)
  const drawer3 = await page.evaluate(() => ({
    name: document.querySelector('.codex-drawer .codex-name')?.textContent?.trim() ?? '',
    crumbs: document.querySelectorAll('.codex-drawer .codex-crumb').length,
  }))
  check('面包屑能跳回上一层', drawer3.crumbs === 1 && drawer3.name === '秦始皇', `${drawer3.crumbs} 层 ${drawer3.name}`)
  await page.screenshot({ path: `${SHOTS}/04-drawer.png` })

  /* ← 退一级（栈只剩一层时等于关闭） */
  await page.keyboard.press('ArrowLeft')
  await sleep(600)
  check('← 键能关掉只剩一层的抽屉', !(await page.evaluate(() => Boolean(document.querySelector('.codex-drawer')))))
  noIssue('档案抽屉')

  /* =========================================================================
   * 尾幕：汇总
   * ======================================================================= */
  /* =========================================================================
   * 第 5 幕：十二朝接力 —— 只点屏幕上看得见的东西，从周一路走到清再回主页
   * ======================================================================= */
  console.log('\n—— 十二朝接力 ——')
  const CHAIN = [
    { id: 'zhou', kind: 'normal', next: '/dynasty/qin' },
    { id: 'qin', kind: 'normal', next: '/dynasty/han' },
    { id: 'han', kind: 'normal', next: '/dynasty/jin' },
    { id: 'jin', kind: 'normal', next: '/dynasty/southern_northern' },
    { id: 'southern_northern', kind: 'nanbei', next: '/dynasty/sui' },
    { id: 'sui', kind: 'normal', next: '/dynasty/tang' },
    { id: 'tang', kind: 'normal', next: '/dynasty/five_dynasties' },
    { id: 'five_dynasties', kind: 'wudai', next: '/dynasty/song' },
    { id: 'song', kind: 'normal', next: '/dynasty/yuan' },
    { id: 'yuan', kind: 'normal', next: '/dynasty/ming' },
    { id: 'ming', kind: 'normal', next: '/dynasty/qing' },
    { id: 'qing', kind: 'normal', next: '/' },
  ]

  for (const step of CHAIN) {
    route = `/dynasty/${step.id}`
    const ready = step.kind === 'nanbei' ? '.nanbei' : step.kind === 'wudai' ? '.wdc-page' : '.timeline-page'
    await gotoRoute(`/dynasty/${step.id}`, ready)
    await sleep(900)

    /* 1) 翻到末页 */
    const dotSel = step.kind === 'nanbei' ? '.nbc-dot' : step.kind === 'wudai' ? '.wdc-dot' : '.timeline-dot'
    await page.evaluate((sel) => {
      const dots = [...document.querySelectorAll(sel)]
      dots[dots.length - 1]?.click()
    }, dotSel)
    await sleep(900)

    /* 2) 末页入口 → 过渡页 */
    const entrySel =
      step.kind === 'nanbei' ? '.nbc-node' : step.kind === 'wudai' ? '.wdc-btn--fall' : '.timeline-btn--endgame'
    const clickedEntry = await page.evaluate((sel) => {
      const el = document.querySelector(sel)
      if (!el) return false
      el.click()
      return true
    }, entrySel)
    if (!clickedEntry) {
      check(`接力「${step.id}」末页有入口`, false, entrySel)
      continue
    }
    await page.waitForSelector('.fall-page', { timeout: 15000 }).catch(() => null)
    const atFall = await page.evaluate(() => Boolean(document.querySelector('.fall-page')))
    if (!atFall) {
      check(`接力「${step.id}」入口能进过渡页`, false, await page.evaluate(() => location.pathname))
      continue
    }

    /* 3) 过渡页：跳过两幕 → 点亮入口 → 进沙盘 */
    await sleep(900)
    for (let i = 0; i < 2; i += 1) {
      await page.mouse.move(700, 420)
      await page.mouse.wheel({ deltaY: 260 })
      await sleep(700)
    }
    await page.mouse.click(700, 430)
    const footOn = await page
      .waitForSelector('.fall-foot[data-visible="true"]', { timeout: 8000 })
      .then(() => true)
      .catch(() => false)
    if (!footOn) {
      check(`接力「${step.id}」过渡页能演完`, false)
      continue
    }
    await page.click('.fall-enter')
    await sleep(1500)
    const atEndgame = await page.evaluate(
      (jin) => Boolean(document.querySelector(jin ? '.jin-chronicle' : '.map-stage')),
      step.id === 'jin',
    )
    if (!atEndgame) {
      check(`接力「${step.id}」过渡页出口能进沙盘`, false, await page.evaluate(() => location.pathname))
      continue
    }

    /* 4) 沙盘：跳到最后一幕 → 关战报 → 终章按钮 → 下一朝 */
    if (step.id === 'jin') {
      await page.evaluate(() => {
        const nodes = [...document.querySelectorAll('.jc-node')]
        nodes[nodes.length - 1]?.click()
      })
      await sleep(900)
      await page
        .waitForSelector('.jc-primary', { timeout: 6000 })
        .then(() => page.click('.jc-primary'))
        .catch(() => null)
    } else {
      /*
        点最后一个节点 = 点一个"还没打过"的国家：先弹补齐确认，
        确认后才播行军序列，播完才弹战报。
        实现统一走 scripts/lib/verify-rail.mjs（原先这里内联了一份，第三份副本已合并）。
      */
      const railCount = await page.evaluate(() => document.querySelectorAll('.rail-node').length)
      await clickRailNode(page, railCount - 1, sleep, { closePanel: true })
      const finale = await page
        .waitForSelector('.qin-entry', { timeout: 8000 })
        .then(() => true)
        .catch(() => false)
      if (!finale) {
        check(`接力「${step.id}」终章按钮能出现`, false)
        continue
      }
      await page.click('.qin-entry')
    }
    await sleep(1600)
    const landed = await page.evaluate(() => location.pathname)
    check(`接力「${step.id}」终章能走到下一站`, landed === step.next, `${landed}（期望 ${step.next}）`)
    noIssue(`接力「${step.id}」`)
  }

  const failed = results.filter((r) => !r.pass)
  console.log(`\n===== ${results.length - failed.length}/${results.length} passed =====`)
  if (issues.length) {
    console.log('\n异常清单：')
    for (const i of issues.slice(0, 20)) console.log(`  [${i.route}] ${i.kind} ${i.msg}`)
  }
  if (failed.length) {
    console.log('\n失败项：')
    for (const f of failed) console.log(`  ✗ ${f.name}`)
    process.exitCode = 1
  }
} finally {
  await browser.close()
}
