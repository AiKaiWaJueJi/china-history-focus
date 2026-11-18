/**
 * check-source.mjs —— 史料原文查证工具（**手工运行，不参与 build / 验收**）
 * ===========================================================================
 * 用途：每补一条文言原文，先在这里过一遍，确认「这句话真的在，而且长这样」。
 * **不允许凭记忆写引文**——本项目口径：「看起来像真的」的引文比没有更糟
 * （docs/交接文档.md §9）。批次 1 之后的帝王原文 171 条、事件注解 316 条都靠它。
 *
 * 两种用法：
 *   A. 定点核对（首选）：已知在哪一卷，直接给页码
 *      { "key": "cx_junxian", "page": "史記/卷006", "phrase": "分天下以為三十六郡" }
 *   B. 全文检索：不知道出处时，让工具去找哪一页含这句
 *      { "key": "cx_bianhu", "phrase": "編戶齊民" }
 *
 * 命令：
 *   node scripts/check-source.mjs probes.json [--context=190]
 *
 * 输出每行：
 *   ✓ key | 《页面》| [一手] | …原文上下文…
 *   ✓ key | 《页面》| [类书/后世] 转引 | …
 *   ✗ key | NOT FOUND / ERROR
 *
 * ⚠ 判据仍是人眼：命中 ≠ 可用。类书复述、后世窜改、小说演义都会命中。
 *   [一手] 只标「页面本身是正史/先秦两汉文献」，不保证那句话没被后人窜改。
 *
 * 限流：维基会 429，所以**串行 + 间隔 + 退避**，一次别塞超过 10 条。
 */
import { readFileSync } from 'node:fs'

const API = 'https://zh.wikisource.org/w/api.php'
const args = process.argv.slice(2)
const probePath = args.find((a) => !a.startsWith('--'))
const opt = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}
const CTX = Number(opt('context', 190))
const GAP = Number(opt('gap', 2000))

/* 来源分级：一手 = 正史本纪/列传/志 + 先秦两汉文献本身 */
const PRIMARY = [
  '史記', '漢書', '後漢書', '三國志', '晉書', '宋書', '南齊書', '梁書', '陳書', '魏書', '北齊書',
  '周書', '隋書', '南史', '北史', '舊唐書', '新唐書', '舊五代史', '新五代史', '宋史', '遼史', '金史',
  '元史', '明史', '清史稿', '左傳', '春秋左氏傳', '國語', '戰國策', '尚書', '詩經', '周禮', '儀禮',
  '禮記', '論語', '孟子', '荀子', '韓非子', '商君書', '管子', '墨子', '呂氏春秋', '淮南子', '通典',
]
/* 类书 / 纪事本末 / 后人辑本：只能算转引，必须写明转引链 */
const SECONDARY = [
  '古今圖書集成', '册府元龜', '冊府元龜', '太平御覽', '藝文類聚', '通志', '文獻通考', '會元', '玉海',
  '資治通鑑', '通鑑', '紀事本末', '四庫全書本', '演義', '聖武記', '東華錄', '實錄', '碑傳集',
]

const tierOf = (title) => {
  /*
    顺序要紧：注疏本（史記正義 / 三國志補註 / 四庫全書本）标题里也带正史名，
    但它们是后人注/辑，只能算转引。所以**先判类书与注疏，再判正史**。
  */
  if (SECONDARY.some((p) => title.includes(p))) return '类书/注疏 转引'
  if (PRIMARY.some((p) => title.includes(p))) return '一手'
  return '未分级（自己判断）'
}

if (!probePath) {
  console.error('用法：node scripts/check-source.mjs probes.json [--context=190] [--gap=2000]')
  process.exit(1)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 带 429 退避的 GET */
async function get(params, attempt = 0) {
  const url = `${API}?${new URLSearchParams({ ...params, format: 'json', formatversion: '2' })}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'china-history-focus/quote-checker (local authoring tool; contact: repo owner)' },
  })
  if (res.status === 429 || res.status >= 500) {
    if (attempt >= 3) throw new Error(`HTTP ${res.status}（重试 3 次仍失败）`)
    const wait = 6000 * (attempt + 1) ** 2
    await sleep(wait)
    return get(params, attempt + 1)
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

function stripWikitext(s) {
  return s
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\{\{[\s\S]*?\}\}/g, '')
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/'''?/g, '')
    .replace(/&nbsp;/g, ' ')
}

/** 定位短语：先原样，再忽略空白（古籍排版常夹空格） */
function locate(text, phrase) {
  const flat = text.replace(/[\s\u3000]+/g, ' ')
  const direct = flat.indexOf(phrase)
  if (direct >= 0) return { index: direct, text: flat }
  const packed = flat.replace(/\s/g, '')
  const needle = phrase.replace(/[\s\u3000]/g, '')
  const p = packed.indexOf(needle)
  if (p < 0) return null
  const map = []
  for (let i = 0; i < flat.length; i += 1) if (!/\s/.test(flat[i])) map.push(i)
  return { index: map[p] ?? 0, text: flat, loose: true }
}

async function tryPage(title, phrase) {
  const parsed = await get({ action: 'parse', page: title, prop: 'wikitext', redirects: '1' })
  if (parsed.error) return null
  const text = stripWikitext(parsed.parse?.wikitext ?? '')
  const found = locate(text, phrase)
  if (!found) return null
  const from = Math.max(0, found.index - CTX)
  const to = Math.min(found.text.length, found.index + phrase.length + CTX)
  return {
    title: parsed.parse?.title ?? title,
    excerpt: found.text.slice(from, to).replace(/\s+/g, ' ').trim(),
    loose: Boolean(found.loose),
    total: found.text.length,
  }
}

const probes = JSON.parse(readFileSync(probePath, 'utf8'))
let ok = 0
let miss = 0

for (const probe of probes) {
  const label = probe.key ?? probe.phrase
  const phrase = probe.phrase
  if (!phrase) {
    console.log(`✗ ${label} | 没给 phrase`)
    miss += 1
    continue
  }
  try {
    let hit = null
    if (probe.page) {
      hit = await tryPage(probe.page, phrase)
      await sleep(GAP)
      if (!hit) {
        console.log(`✗ ${label} | 指定页《${probe.page}》里没找到「${phrase}」（可能页码错，去掉 page 改用全文检索）`)
        miss += 1
        continue
      }
    } else {
      const search = await get({ action: 'query', list: 'search', srsearch: `"${phrase}"`, srlimit: '8', srnamespace: '0' })
      await sleep(GAP)
      const hits = search.query?.search ?? []
      if (!hits.length) {
        console.log(`✗ ${label} | NOT FOUND（全文检索无命中：${phrase}）`)
        miss += 1
        continue
      }
      /* 一手优先：先把正史/先秦文献挑前面，类书垫后 */
      const rank = (t) => (PRIMARY.some((p) => t.title.includes(p)) ? 0 : SECONDARY.some((p) => t.title.includes(p)) ? 2 : 1)
      for (const h of [...hits].sort((a, b) => rank(a) - rank(b)).slice(0, 3)) {
        hit = await tryPage(h.title, phrase)
        await sleep(GAP)
        if (hit) break
      }
      if (!hit) {
        console.log(`✗ ${label} | 检索有命中但正文没定位到原句（${hits.slice(0, 3).map((h) => h.title).join(' / ')}）`)
        miss += 1
        continue
      }
    }
    console.log(`✓ ${label} | 《${hit.title}》| [${tierOf(hit.title)}]${hit.loose ? ' 松散匹配' : ''} | …${hit.excerpt}…`)
    ok += 1
  } catch (err) {
    console.log(`✗ ${label} | ERROR ${err.message}`)
    miss += 1
  }
}

console.log(`\n===== 命中 ${ok} / 共 ${probes.length}（未命中 ${miss}）=====`)
console.log('[一手] 只说明页面本身是正史/先秦文献；文字是否被后人窜改，仍要自己读上下文判断。')
