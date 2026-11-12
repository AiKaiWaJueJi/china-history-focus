/**
 * 全局字号上调
 * ---------------------------------------------------------------------------
 * 需求：辅助说明文字（朝代时间、事件概述等）整体上调 2-4px。
 * 做法：按**选择器**定位后精确改 font-size，而不是全文件正则替换 ——
 *       后者会把标题、大字也一起放大，破坏层级。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** selector → 新字号（px） */
const TABLE = {
  'src/index.css': {
    '.dyn-ord': 11,
    '.dyn-period': 12,
    '.dyn-detail-line': 11,
    '.dyn-detail-item': 12,
    '.app-sub': 11.5,
    '.app-hint': 12,
  },
  'src/features/emperor-timeline/emperor-timeline.css': {
    '.timeline-period': 13,
    '.timeline-count': 14,
    '.timeline-hint': 11.5,
    '.seg-band-name': 14,
    '.seg-band-range': 11.5,
    '.seg-marker-label': 13.5,
    '.seg-marker-label em': 11,
    '.lords-count': 12.5,
    '.lords-hint': 11,
    '.lord-era': 11,
    '.lord-title': 13.5,
    '.lord-period': 11.5,
    '.lord-hegemony': 11.5,
    '.emp-name': 16,
    '.emp-reign': 14,
    '.emp-event-name': 15.5,
    '.emp-event-year': 13,
    '.emp-group-label': 13,
    '.lords-empty-text': 14,
    '.timeline-empty-sub': 13,
  },
}

const escape = (sel) => sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

let changed = 0
for (const [rel, map] of Object.entries(TABLE)) {
  const file = join(ROOT, rel)
  let css = readFileSync(file, 'utf8')

  for (const [selector, size] of Object.entries(map)) {
    // 匹配 "选择器 { ... font-size: X px ... }"
    const re = new RegExp(`(${escape(selector)}\\s*\\{[^}]*?font-size:\\s*)([0-9.]+)px`)
    const match = css.match(re)
    if (!match) {
      console.log(`  未匹配：${rel} :: ${selector}`)
      continue
    }
    if (Number(match[2]) === size) continue
    css = css.replace(re, `$1${size}px`)
    changed++
    console.log(`  ${selector}: ${match[2]}px → ${size}px`)
  }

  writeFileSync(file, css, 'utf8')
}

console.log(`\n共调整 ${changed} 处字号`)
