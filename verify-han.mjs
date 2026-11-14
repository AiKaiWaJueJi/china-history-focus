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

try {
  const page = await browser.newPage()
  await page.setCacheEnabled(false)
  page.on('pageerror', (e) => console.log('[PAGEERROR]', String(e).slice(0, 160)))

  await page.goto(`${BASE}/dynasty/han`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.pager')
  await sleep(900)

  const shell = await page.evaluate(() => ({
    count: document.querySelector('.timeline-count')?.textContent?.trim(),
    dots: document.querySelectorAll('.timeline-dot').length,
    portraits: [...document.querySelectorAll('.emp-card')].map((n) => getComputedStyle(n).getPropertyValue('--portrait').trim()),
    titles: [...document.querySelectorAll('.emp-title')].map((n) => n.textContent?.trim()),
  }))
  console.log('[SHELL]', JSON.stringify(shell))
  check('共 27 位帝王 · 10 页', shell.count?.includes('27') && shell.count?.includes('/ 10'), shell.count)
  check('首页三位为高惠文', shell.titles.join(',') === '漢高祖,漢惠帝,漢文帝', shell.titles.join(','))
  check('分页点 10 个', shell.dots === 10, String(shell.dots))
  check('画像走 CSS 变量且指向 han-*', shell.portraits.every((s) => s.includes('/portraits/han-')), JSON.stringify(shell.portraits))

  const goPage = async (n) => {
    await page.click(`[aria-label="第 ${n} 页"]`)
    await sleep(900)
    return page.evaluate(() => ({
      count: document.querySelector('.timeline-count')?.textContent?.trim(),
      titles: [...document.querySelectorAll('.emp-title')].map((n) => n.textContent?.trim()),
      slots: document.querySelectorAll('.emp-slot').length,
      button: document.querySelector('.timeline-btn--endgame')?.textContent?.trim() ?? null,
    }))
  }

  const p4 = await goPage(4)
  console.log('[P4]', JSON.stringify(p4))
  check('第 4 页为哀、平、孺子婴', p4.titles.join(',') === '漢哀帝,漢平帝,孺子婴', p4.titles.join(','))
  check('第 4 页入口为「王莽篡汉」', (p4.button ?? '').includes('王莽篡漢'), p4.button)

  const p5 = await goPage(5)
  console.log('[P5]', JSON.stringify(p5))
  check('第 5 页只有王莽一人', p5.titles.join(',') === '新·王莽', p5.titles.join(','))
  check('新朝页补两个空槽', p5.slots === 2, String(p5.slots))
  check('第 5 页入口为「光武中兴」', (p5.button ?? '').includes('光武中兴'), p5.button)

  /** 把当前过渡页一字一字走完，并点「入…」 */
  const runFall = async () => {
    for (let guard = 0; guard < 8; guard++) {
      await sleep(700)
      await page.mouse.click(720, 460)
      await sleep(400)
      const state = await page.evaluate(() => {
        const root = document.querySelector('.fall-page')
        const btn = document.querySelector('.fall-enter')
        const foot = document.querySelector('.fall-foot')
        return {
          exists: Boolean(root),
          page: root?.getAttribute('data-page'),
          total: document.querySelectorAll('.fall-pager span').length,
          enterReady: Boolean(btn) && foot?.getAttribute('data-visible') === 'true',
          title: document.querySelector('.fall-brand-title')?.textContent?.trim(),
        }
      })
      if (!state.exists) return state
      if (Number(state.page) === state.total - 1 && state.enterReady) {
        await page.click('.fall-enter')
        await sleep(1500)
        return { ...state, entered: true, url: page.url() }
      }
      await page.mouse.wheel({ deltaY: 320 })
      await sleep(500)
    }
    return { entered: false }
  }

  /* 从第 4 页下滚 → 王莽篡汉过渡页 → 回第 5 页（新朝） */
  await goPage(4)
  await sleep(1200)
  await page.keyboard.press('ArrowRight')
  await sleep(900)
  const xinUrl = page.url()
  check('第 4 页下滚进入「王莽篡汉」', xinUrl.includes('/fall/xin'), xinUrl)
  const xinTitle = await page.evaluate(() => document.querySelector('.fall-brand-title')?.textContent?.trim())
  check('过渡页标题为「王莽篡汉」', xinTitle === '王莽篡漢', xinTitle)
  const afterXin = await runFall()
  console.log('[AFTER-XIN]', JSON.stringify(afterXin))
  const backXin = await page.evaluate(() => document.querySelector('.timeline-count')?.textContent?.trim())
  check('走完过渡回时间轴第 5 页（新朝）', backXin?.includes('第 5 / 10'), backXin)

  /* 第 5 页下滚 → 光武中兴 → 回第 6 页（东汉） */
  await sleep(1200)
  await page.keyboard.press('ArrowRight')
  await sleep(900)
  const zhUrl = page.url()
  check('第 5 页下滚进入「光武中兴」', zhUrl.includes('/fall/zhongxing'), zhUrl)
  const afterZh = await runFall()
  console.log('[AFTER-ZHONGXING]', JSON.stringify(afterZh))
  const backZh = await page.evaluate(() => ({
    count: document.querySelector('.timeline-count')?.textContent?.trim(),
    title: document.querySelector('.emp-title')?.textContent?.trim(),
  }))
  check('走完过渡回东汉首页', backZh.count?.includes('第 6 / 10') && backZh.title === '漢光武帝', JSON.stringify(backZh))

  /* 收尾过渡页 */
  await page.goto(`${BASE}/dynasty/han/fall`, { waitUntil: 'networkidle2' })
  await sleep(600)
  const fallTitle = await page.evaluate(() => ({
    title: document.querySelector('.fall-brand-title')?.textContent?.trim(),
    sub: document.querySelector('.fall-brand-sub')?.textContent?.trim(),
  }))
  check('收尾过渡页为「汉魏禅代」', fallTitle.title === '漢魏禅代' && fallTitle.sub === '漢亡', JSON.stringify(fallTitle))

  /* 末页 → 收尾过渡 → 三国沙盘 */
  await page.goto(`${BASE}/dynasty/han`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('.pager')
  await sleep(600)
  const last = await goPage(10)
  console.log('[LAST]', JSON.stringify(last))
  check('末页为少帝辩与献帝', last.titles.join(',') === '少帝,漢献帝', last.titles.join(','))
  check('末页入口为「汉亡」', (last.button ?? '').includes('漢亡'), last.button)
  await page.click('.timeline-btn--endgame')
  await sleep(900)
  check('末页下滚进入「汉魏禅代」', page.url().includes('/dynasty/han/fall'), page.url())
  const afterFall = await runFall()
  console.log('[AFTER-FALL]', JSON.stringify(afterFall))
  await page.waitForSelector('.map-stage', { timeout: 10000 })
  const endgameTitle = await page.evaluate(() => document.querySelector('.endgame-title')?.textContent?.trim())
  check('收尾过渡走完进入三国沙盘', page.url().includes('/dynasty/han/endgame') && endgameTitle === '三国归晋', `${page.url()} ${endgameTitle}`)

  await browser.close()
} catch (err) {
  console.error(err)
  await browser.close()
  process.exitCode = 1
}
const failed = results.filter((r) => !r.pass)
console.log(`\n===== ${results.length - failed.length}/${results.length} passed =====`)
if (failed.length) process.exitCode = 1
