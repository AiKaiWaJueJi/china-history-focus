/**
 * verify-segment-intro.mjs —— 段间过渡页（改朝换代处的「时间轴裁剪」）验收
 * ===========================================================================
 * 这一套页面是用户明确要的结构：**改朝换代处把时间轴裁断，中间插一屏过渡页**。
 * 周（平王东迁）、汉（王莽篡漢 / 光武中兴）、晋（衣冠南渡）早就这么做；
 * 本脚本把后续朝代也纳入同一套断言，防止「有数据但入口没接」或回错页：
 *
 *   1. 在段末页继续下滑 → 进 `/dynasty/<id>/fall/<chapter>`（而不是翻到下一段）；
 *   2. 过渡页三幕齐全、标题对得上；
 *   3. 演完 → 回到时间轴的**下一段首页**（页码要精确对）；
 *   4. 第一幕上滚 → 确认框 → 回到触发页（页码精确对）。
 *
 * 为什么页码要在脚本里重算而不是写死：PAGE_SIZE=3、按 segmentId 分组，
 * 加一个帝王就会移位。
 */
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'node:fs'

const BASE = process.env.APP_URL ?? 'http://localhost:5180'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PAGE_SIZE = 3

/** 与 DynastyDetail.pages 同一套分页规则 */
function pagesOf(id) {
  const file = JSON.parse(readFileSync(new URL(`./src/data/emperors.${id}.json`, import.meta.url), 'utf8'))
  const out = []
  let group = []
  let seg
  const flush = () => {
    for (let i = 0; i < group.length; i += PAGE_SIZE) out.push(group.slice(i, i + PAGE_SIZE))
    group = []
  }
  for (const e of file.emperors) {
    if (seg !== undefined && e.segmentId !== seg) flush()
    seg = e.segmentId
    group.push(e)
  }
  flush()
  return out
}

/** 某分段第一页的页码（0 基） */
function firstPageOfSegment(id, segId) {
  const pages = pagesOf(id)
  return pages.findIndex((p) => p[0]?.segmentId === segId)
}

const CASES = []
for (const [id, segId, chapter] of [
  ['zhou', 'seg_dongzhou', 'dongqian'],
  ['han', 'seg_xin', 'xin'],
  ['han', 'seg_donghan', 'zhongxing'],
  ['jin', 'seg_dongjin', 'yongjia'],
  ['tang', 'seg_wuzhou', 'wuzhou'],
  ['tang', 'seg_shengtang', 'shenlong'],
  ['song', 'seg_nansong', 'jingkang'],
  ['qing', 'seg_ruquan', 'ruquan'],
]) {
  const next = firstPageOfSegment(id, segId)
  CASES.push({ id, chapter, gate: next - 1, expect: next })
}

/* 五代十国走 WuDaiTimeline（5 页，每页一个易代节点），页码直接取页窗口 */
const WUDAI = [
  { chapter: 'houtang', gate: 0, expect: 1 },
  { chapter: 'shijin', gate: 1, expect: 2 },
  { chapter: 'qidan', gate: 2, expect: 3 },
  { chapter: 'houzhou', gate: 3, expect: 4 },
]

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

const pageIndex = async (page, wudai) => {
  if (wudai) {
    const t = await page.evaluate(() => document.querySelector('.wdc-count')?.textContent ?? '')
    const m = t.match(/第\s*(\d+)\s*\/\s*(\d+)\s*页/)
    return m ? Number(m[1]) - 1 : -1
  }
  const t = await page.evaluate(() => document.querySelector('.timeline-count')?.textContent ?? '')
  const m = t.match(/第\s*(\d+)\s*\/\s*(\d+)\s*页/)
  return m ? Number(m[1]) - 1 : -1
}

/** 走完三幕并点进下一段（跳过逐字：点击页面 + 下滚两下） */
async function runThrough(page) {
  for (let i = 0; i < 2; i += 1) {
    await page.mouse.move(720, 450)
    await page.mouse.wheel({ deltaY: 240 })
    await sleep(820)
  }
  await page.mouse.click(720, 460)
  await sleep(600)
  await page.click('.fall-enter')
  await sleep(2000)
}

try {
  const page = await browser.newPage()
  await page.setCacheEnabled(false)
  page.on('pageerror', (e) => console.log('[PAGEERROR]', String(e).slice(0, 160)))

  const all = [
    ...CASES.map((c) => ({ ...c, wudai: false })),
    ...WUDAI.map((c) => ({ ...c, id: 'five_dynasties', wudai: true })),
  ]

  for (const c of all) {
    const tag = `${c.id}/${c.chapter}`
    await page.goto(`${BASE}/dynasty/${c.id}`, { waitUntil: 'networkidle2', timeout: 60000 })
    await page.waitForSelector(c.wudai ? '.wdc-stage' : '.pager', { timeout: 15000 })
    await sleep(900)

    // 跳到触发页
    if (c.gate > 0) {
      await page.click(`[aria-label="第 ${c.gate + 1} 页"]`)
      await sleep(900)
    }
    const atGate = await pageIndex(page, c.wudai)
    check(`${tag} 停在触发页`, atGate === c.gate, `第 ${atGate + 1} 页`)

    // 段末继续下滑 → 进过渡页
    await page.mouse.move(720, 450)
    await page.mouse.wheel({ deltaY: 240 })
    await sleep(1400)
    const url = page.url()
    check(`${tag} 下滚进段间过渡页`, url.endsWith(`/fall/${c.chapter}`), url)

    const fall = await page.evaluate(() => ({
      title: document.querySelector('.fall-brand-title')?.textContent?.trim() ?? '',
      dots: document.querySelectorAll('.fall-dot').length,
      empty: Boolean(document.querySelector('.fall-page--empty')),
    }))
    check(`${tag} 过渡页三幕且未落空页`, fall.dots === 3 && !fall.empty, JSON.stringify(fall))

    // 第一幕上滚 → 确认框 → 回触发页
    await page.mouse.wheel({ deltaY: -240 })
    await sleep(900)
    const dialog = await page.evaluate(() => Boolean(document.querySelector('.fall-confirm')))
    check(`${tag} 上滚弹出返回确认`, dialog)
    if (dialog) {
      await page.click('.fall-confirm-primary')
      await sleep(1400)
      const backIndex = await pageIndex(page, c.wudai)
      check(`${tag} 返回落在触发页`, backIndex === c.gate, `第 ${backIndex + 1} 页`)
    }

    // 重新进入，走完三幕 → 落到下一段首页
    await page.goto(`${BASE}/dynasty/${c.id}/fall/${c.chapter}`, { waitUntil: 'networkidle2', timeout: 60000 })
    await page.waitForSelector('.fall-page', { timeout: 15000 })
    await sleep(900)
    await runThrough(page)
    const landed = new URL(page.url()).pathname
    check(`${tag} 演完回到本朝时间轴`, landed === `/dynasty/${c.id}`, landed)
    const idx = await pageIndex(page, c.wudai)
    check(`${tag} 落在下一段首页`, idx === c.expect, `第 ${idx + 1} 页（应为第 ${c.expect + 1} 页）`)
  }

  await browser.close()
} catch (err) {
  console.error(err)
  await browser.close()
  process.exitCode = 1
}

const failed = results.filter((r) => !r.pass)
console.log(`\n===== ${results.length - failed.length}/${results.length} passed =====`)
if (failed.length) process.exitCode = 1
