/**
 * diag-quote.mjs —— 截战报栏（含史料原文）与悬浮今译
 */
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = 'D:\\文档\\deepseek-harness\\default-workspace\\china-history-focus\\shots\\v9'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--no-sandbox', '--force-device-scale-factor=1'],
  defaultViewport: { width: 1600, height: 900 },
})
const page = await browser.newPage()
await page.setCacheEnabled(false)
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])
await page.goto('http://localhost:5180/dynasty/zhou/endgame', { waitUntil: 'networkidle2' })
await page.waitForSelector('.map-stage')
await page.evaluate(() => document.fonts.ready)
await sleep(1200)

// 打开「赵」的战报
await page.evaluate(() => {
  const el = document.querySelector('[data-nation="zhao"] .region-base')
  const r = el.getBoundingClientRect()
  const ev = new MouseEvent('click', {
    bubbles: true,
    clientX: r.x + r.width / 2,
    clientY: r.y + r.height / 2,
  })
  document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.dispatchEvent(ev)
})
await sleep(1000)
await page.screenshot({ path: `${OUT}\\01-panel-quote.png` })

const info = await page.evaluate(() => {
  const text = document.querySelector('.source-text')
  const body = document.querySelector('.source-body')
  const quote = document.querySelector('.source-quote')
  const cs = getComputedStyle(text)
  const r = text.getBoundingClientRect()
  return {
    hasQuote: Boolean(quote),
    book: document.querySelector('.source-book-name')?.textContent,
    writingMode: cs.writingMode,
    fontFamily: cs.fontFamily.split(',')[0],
    columns: Math.round(r.width / 34),
    textHeight: Math.round(r.height),
    panelScroll: {
      scrollHeight: document.querySelector('.battle-panel').scrollHeight,
      clientHeight: document.querySelector('.battle-panel').clientHeight,
    },
    bodyTabIndex: body?.getAttribute('tabindex'),
  }
})
console.log('[QUOTE] ' + JSON.stringify(info))

// 悬浮出今译
const box = await page.evaluate(() => {
  const r = document.querySelector('.source-text').getBoundingClientRect()
  return { x: r.x + 20, y: r.y + 40 }
})
await page.mouse.move(box.x, box.y, { steps: 3 })
await sleep(600)
const tip = await page.evaluate(() => {
  const el = document.querySelector('.source-tooltip')
  const cs = el ? getComputedStyle(el) : null
  return {
    exists: Boolean(el),
    opacity: cs ? Number(cs.opacity) : 0,
    text: el?.textContent?.replace(/\s+/g, ' ').slice(0, 40),
  }
})
console.log('[TOOLTIP] ' + JSON.stringify(tip))
await page.screenshot({ path: `${OUT}\\02-quote-tooltip.png` })

await browser.close()
