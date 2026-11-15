/**
 * verify-map-points.mjs —— 沙盘要地/关隘方位
 * ---------------------------------------------------------------------------
 * 地图上的关隘、战场、都城不能只是装饰，必须落在对应疆域内（几何脚本已校验），
 * 这里再确认三张图都能把各自的要地点渲染出来，且数量与数据一致。
 */
import puppeteer from 'puppeteer-core'

const BASE = process.env.APP_URL ?? 'http://localhost:5180'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' :: ' + detail : ''}`)
}

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--no-sandbox', '--force-device-scale-factor=1'],
  defaultViewport: { width: 1440, height: 900 },
})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

try {
  const page = await browser.newPage()
  await page.setCacheEnabled(false)
  page.on('pageerror', (e) => console.log('[PAGEERROR]', String(e).slice(0, 160)))

  const readPoints = async (url) => {
    await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle2', timeout: 60000 })
    await page.waitForSelector('.map-stage')
    await sleep(1000)
    return page.evaluate(() => ({
      names: [...document.querySelectorAll('.strategic-point text')].map((n) => n.textContent?.trim()),
      layer: document.querySelectorAll('.strategic-layer').length,
    }))
  }

  const zhou = await readPoints('/dynasty/zhou/endgame')
  console.log('[ZHOU]', JSON.stringify(zhou.names))
  // 国都已经单独出地名，要地只留「不是国都」的关隘与战场
  check('战国图标出 3 处要地', zhou.names.length === 3, JSON.stringify(zhou.names))
  check('战国图含函谷关与井陉', zhou.names.includes('函谷关') && zhou.names.includes('井陉'), zhou.names.join(','))

  const qin = await readPoints('/dynasty/qin/endgame')
  console.log('[QIN]', JSON.stringify(qin.names))
  check('楚汉图标出 4 处要地', qin.names.length === 4, String(qin.names.length))
  check('楚汉图含垓下与井陉', qin.names.includes('垓下') && qin.names.includes('井陉'), qin.names.join(','))

  const han = await readPoints('/dynasty/han/endgame')
  console.log('[HAN]', JSON.stringify(han.names))
  check('三国图标出 5 处要地', han.names.length === 5, String(han.names.length))
  // 换底板后阴平（甘肃文县）落在魏境，改标阳平关（汉中属蜀）；合肥在淮南属吴，改标寿春
  check('三国图含剑阁、阳平关、江陵', ['剑阁', '阳平关', '江陵'].every((n) => han.names.includes(n)), han.names.join(','))

  await browser.close()
} catch (err) {
  console.error(err)
  await browser.close()
  process.exitCode = 1
}

const failed = results.filter((r) => !r.pass)
console.log(`\n===== ${results.length - failed.length}/${results.length} passed =====`)
if (failed.length) process.exitCode = 1
