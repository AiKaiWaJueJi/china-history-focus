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

  await page.goto(`${BASE}/dynasty/jin`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.pager')
  await sleep(900)
  const shell = await page.evaluate(() => ({
    count: document.querySelector('.timeline-count')?.textContent?.trim(),
    dots: document.querySelectorAll('.timeline-dot').length,
    titles: [...document.querySelectorAll('.emp-title')].map((n) => n.textContent?.trim()),
    portrait: getComputedStyle(document.querySelector('.emp-card')).getPropertyValue('--portrait'),
  }))
  console.log('[SHELL]', JSON.stringify(shell))
  check('晋 15 帝 / 6 页', shell.count?.includes('15') && shell.count?.includes('/ 6'), shell.count)
  check('首页为武、惠、怀三帝', shell.titles.join(',') === '晋武帝,晋惠帝,晋怀帝', shell.titles.join(','))
  check('画像使用程序化占位 SVG', shell.portrait.includes('jin-wu.svg'), shell.portrait)

  const goPage = async (n) => {
    await page.click(`[aria-label="第 ${n} 页"]`)
    await sleep(800)
    return page.evaluate(() => ({
      count: document.querySelector('.timeline-count')?.textContent?.trim(),
      titles: [...document.querySelectorAll('.emp-title')].map((n) => n.textContent?.trim()),
      button: document.querySelector('.timeline-btn--endgame')?.textContent?.trim() ?? null,
    }))
  }

  const p2 = await goPage(2)
  console.log('[P2]', JSON.stringify(p2))
  check('第 2 页为西晋末帝', p2.titles.join(',') === '晋愍帝', p2.titles.join(','))
  check('西晋末页入口为「衣冠南渡」', (p2.button ?? '').includes('衣冠南渡'), p2.button)

  await sleep(900)
  await page.keyboard.press('ArrowRight')
  await sleep(900)
  check('下滚进入「永嘉南渡」段间过渡', page.url().includes('/fall/yongjia'), page.url())
  const yTitle = await page.evaluate(() => document.querySelector('.fall-brand-title')?.textContent?.trim())
  check('过渡页标题为「永嘉南渡」', yTitle === '永嘉南渡', yTitle)

  // 进入过渡页后：等惯性保护，再下滚两次跳到第三幕，点击结束逐字
  await sleep(900)
  for (let i = 0; i < 2; i += 1) {
    await page.mouse.move(700, 450)
    await page.mouse.wheel({ deltaY: 220 })
    await sleep(700)
  }
  await page.mouse.click(720, 460)
  await sleep(600)
  await page.click('.fall-enter')
  await sleep(2000)
  const back = await page.evaluate(() => ({
    count: document.querySelector('.timeline-count')?.textContent?.trim(),
    titles: [...document.querySelectorAll('.emp-title')].map((n) => n.textContent?.trim()),
  }))
  check('走完过渡回东晋首页', back.count?.includes('第 3 / 6') && back.titles.includes('晋元帝'), JSON.stringify(back))

  await goPage(6)
  await sleep(900)
  const last = await page.evaluate(() => ({
    titles: [...document.querySelectorAll('.emp-title')].map((n) => n.textContent?.trim()),
    button: document.querySelector('.timeline-btn--endgame')?.textContent?.trim() ?? null,
  }))
  console.log('[LAST]', JSON.stringify(last))
  check('末页为安、恭二帝', last.titles.join(',') === '晋安帝,晋恭帝', last.titles.join(','))
  check('末页入口为「晋亡」', (last.button ?? '').includes('晋亡'), last.button)
  await page.click('.timeline-btn--endgame')
  await sleep(900)
  check('末页进入「晋宋禅代」', page.url().includes('/dynasty/jin/fall'), page.url())

  await browser.close()
} catch (err) {
  console.error(err)
  await browser.close()
  process.exitCode = 1
}
const failed = results.filter((r) => !r.pass)
console.log(`\n===== ${results.length - failed.length}/${results.length} passed =====`)
if (failed.length) process.exitCode = 1

