/**
 * check-source.mjs —— 史料原文查证工具（**手工运行，不参与 build / 验收**）
 * ===========================================================================
 * 用途：每补一条文言原文，先在这里过一遍，确认「这句话真的在，而且长这样」。
 * **不允许凭记忆写引文**——本项目口径：「看起来像真的」的引文比没有更糟
 * （docs/交接文档.md §9）。
 *
 * 三种用法：
 *   A. 定点核对（首选）：已知在哪一卷，直接给页码（phrase 用**繁体**，页面就是繁体）
 *      node scripts/check-source.mjs probes.json [--context=190] [--gap=2000]
 *      [ { "key": "cx_junxian", "page": "史記/卷006", "phrase": "分天下以為三十六郡" } ]
 *   B. 全文检索：不知道出处时，让工具去找哪一页含这句（同上，但去掉 page）
 *   C. 整本复查：把 codex.quotes.json 全部回原书核一遍（要 source-pages.json 映射）
 *      node scripts/check-source.mjs --quotes=scripts/data/codex.quotes.json
 *
 * 缓存（2026-11-19 加，最大的一次提速）
 *   `.cache/sources/` 存两类东西：页面 wikitext、以及「我们的引文转成繁体」的结果。
 *   第一遍要联网；之后同一卷/同一句**零请求**，整本复查从 7 分钟掉到 1 秒级。
 *   加 --refresh 强制重拉（怀疑维基页面被改过时用）。
 *   缓存不提交（.gitignore 里有 .cache/）。
 *
 * 比对的四条口径（都是踩出来的，别改回去）
 *   1. 页面取 wikitext 原文（繁体）：zh-hans 页面级转换是残的，术/於/羣会漏，做基准不可靠；
 *   2. 我们的简体引文先经 MediaWiki 转 zh-hant，再和繁体原页比（同一套转换表，反向用）；
 *   3. 只比汉字与数字：标点、引号样式不参与（源文用“”，我们用「」，比标点等于自己判自己红）；
 *   4. 异体字走同一张归一表（羣/群、於/于、彊/强、兾/冀、衞/衛、製/制……）。
 *
 * ⚠ 判据仍是人眼：命中 ≠ 可用。类书复述、后世窜改、演义都会命中；
 *   更要命的坑是「同一句话出自别人之口」（《甘誓》的「恭行天之罚」不是武王说的）。
 *   [一手] 只说明页面本身是正史/先秦文献，不保证归属正确。
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const API = 'https://zh.wikisource.org/w/api.php'
const CACHE_DIR = '.cache/sources'

const args = process.argv.slice(2)
const probePath = args.find((a) => !a.startsWith('--'))
const include = (name) => args.includes(`--${name}`)
const opt = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

const CTX = Number(opt('context', 190))
const GAP = Number(opt('gap', 2000))
const REFRESH = include('refresh')
const QUOTES = opt('quotes', '')

/* 来源分级：一手 = 正史本纪/列传/志 + 先秦两汉文献本身 */
const PRIMARY = [
  '史記', '漢書', '後漢書', '三國志', '晉書', '宋書', '南齊書', '梁書', '陳書', '魏書', '北齊書',
  '周書', '隋書', '南史', '北史', '舊唐書', '新唐書', '舊五代史', '新五代史', '宋史', '遼史', '金史',
  '元史', '明史', '清史稿', '左傳', '春秋左氏傳', '國語', '戰國策', '尚書', '詩經', '周禮', '儀禮',
  '禮記', '論語', '孟子', '荀子', '韓非子', '商君書', '管子', '墨子', '呂氏春秋', '淮南子', '通典',
]
/* 类书 / 注疏 / 纪事本末 / 后人辑本：只能算转引，必须写明转引链 */
const SECONDARY = [
  '古今圖書集成', '册府元龜', '冊府元龜', '太平御覽', '藝文類聚', '通志', '文獻通考', '會元', '玉海',
  '資治通鑑', '通鑑', '紀事本末', '四庫全書本', '正義', '索隱', '集解', '補註', '演義', '聖武記',
  '東華錄', '實錄', '碑傳集',
]

/**
 * 异体字归一表。
 * 繁简转换不负责「异体字对」（羣/群、於/于、彊/强、兾/冀、卽/即……），维基又常照底本保留古字，
 * 于是同一句话两边都写着、字面却不同。这只影响**比对**，不改数据。
 * 新失败大多是在这里缺一条——看输出里的「源文此处」，把那一对补进来即可。
 */
const VARIANTS = {
  羣: '群', 卽: '即', 內: '内', 於: '于', 兾: '冀', 柰: '奈', 鬬: '斗', 鬥: '斗', 犇: '奔',
  慍: '愠', 讎: '仇', 屍: '尸', 臺: '台', 虛: '虚', 眞: '真', 敍: '叙', 爲: '为', 嚮: '向',
  徳: '德', 敎: '教', 旣: '既', 衆: '众', 恥: '耻', 閒: '间', 彊: '强', 寛: '宽', 郞: '郎',
  製: '制', 衞: '卫', 衛: '卫', 灋: '法', 愼: '慎', 曁: '暨', 冊: '册', 麤: '粗',
  強: '强', 仆: '仆', 僕: '仆', 煑: '煮', 昬: '昏', 睠: '眷', 慙: '惭', 眎: '视', 祇: '只',
  冨: '富', 槩: '概', 廼: '乃', 迺: '乃', 甯: '宁', 絜: '洁', 澹: '淡', 缾: '瓶', 鉅: '巨',
  欵: '款', 宻: '密',
  /* 以下四条是批次 2d（晋书）补的：
     · 爲/為 两种繁体写法在维基不同卷里混用，甚至同一页里简繁混杂（"或为人患"）；
     · 云/雲 转换会把「乃云」错转成「乃雲」——这是转换表的方向误判，不是我们写错；
     · 徵/征：原文「何徵祥之有」，简体通行作「征祥」。 */
  爲: '为', 為: '为', 雲: '云', 徵: '征',
  /* 以下八对是批次 2e（漢書/後漢書）补的。成因分两类，都不是我们写错：
     · 引文转繁后与底本用字不同：叹→嘆 而底本作歎（孔子歎「學之不講」）；
       灾→災 而底本作灾（海內頗有灾異）。
     · 底本保留古字，转换表不认：恱/悦、勑/敕、乆/久、姦/奸、餚/肴。
     一律以**简体通行字**为归一目标，与表内既有条目一致。 */
  悅: '悦', 恱: '悦', 勑: '敕', 乆: '久', 災: '灾', 姦: '奸', 歎: '叹', 嘆: '叹',
  /* 餚/肴 已由《國語·周語中》定王条实测确认（简体只能转出「肴」），与上批同批落地 */
  餚: '肴',
  /* 孝质帝「聦敏」、耆儒「年踰六十」：底本作聦/踰，引文转繁后是聰/逾 */
  聰: '聪', 聦: '聪', 踰: '逾',
  /* 唐朝批次补：底本作「荒饑」「大樑」，简体转繁出「飢」「梁」 */
  饑: '饥', 飢: '饥', 樑: '梁', 迴: '回',
  /* 宋朝批次补：光宗御批「念欲退閑」，简体转繁出「閒」而底本作「閑」（既有 閒:'间' 只管前者） */
  閑: '间',
  /* 宋朝批次（第二批）：禦/佈/餘 是底本古字与转换表的方向差，无歧义，直接补。
     後:'后' 是**有代价**的一对：「後」（之后）与「后」（后妃）在繁体里是两个不同的字，
     而简体「后」一字兼两义，转换表一律转成「後」，于是「后族」对不上底本的「后族」。
     收下它意味着比对时不再区分「後」与「后」——这层歧义靠人眼在归属环节看，机器只保字句为真。 */
  禦: '御', 佈: '布', 餘: '余', 後: '后',
}

const tierOf = (title) => {
  /* 顺序要紧：注疏本标题里也带正史名，但它们只能算转引 → 先判类书与注疏，再判正史 */
  if (SECONDARY.some((p) => title.includes(p))) return '类书/注疏 转引'
  if (PRIMARY.some((p) => title.includes(p))) return '一手'
  return '未分级（自己判断）'
}

if (!probePath && !QUOTES) {
  console.error('用法：node scripts/check-source.mjs probes.json [--context=190] [--gap=2000] [--refresh]')
  console.error('  或：node scripts/check-source.mjs --quotes=scripts/data/codex.quotes.json [--pages=scripts/data/source-pages.json]')
  process.exit(1)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const stats = { requests: 0, pageHits: 0, convHits: 0 }

/** 带 429 退避的 GET */
async function get(params, attempt = 0) {
  const url = `${API}?${new URLSearchParams({ ...params, format: 'json', formatversion: '2' })}`
  stats.requests += 1
  const res = await fetch(url, {
    headers: { 'User-Agent': 'china-history-focus/quote-checker (local authoring tool; contact: repo owner)' },
  })
  if (res.status === 429 || res.status >= 500) {
    if (attempt >= 3) throw new Error(`HTTP ${res.status}（重试 3 次仍失败）`)
    await sleep(6000 * (attempt + 1) ** 2)
    return get(params, attempt + 1)
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

function stripWikitext(s) {
  return s
    .replace(/<!--[\s\S]*?-->/g, '')
    /* MediaWiki 的语言转换标记会夹在**字中间**：《舊唐書》把「魏徵」写成「魏-{徵}-」，
       不去掉的话任何含「徵」的引文都会在比对时断在这里（不是我们的字错）。
       只处理 `-{X}-` 这种单纯形式；带 `:` 的 `-{zh-hans:…;zh-hant:…}-` **故意不匹配**，
       宁可让复查显式失败，也不要静默挑一个变体。 */
    .replace(/-\{([^{}:]*)\}-/g, '$1')
    .replace(/\{\{[\s\S]*?\}\}/g, '')
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/'''?/g, '')
    .replace(/&nbsp;/g, ' ')
}

/** HTML（MediaWiki 解析输出）→ 纯文本：去脚注/引用、去标签、解实体、去空白 */
function stripHtml(html) {
  return html
    .replace(/<sup[^>]*>[\s\S]*?<\/sup>/g, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/g, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/[\s\u3000]+/g, '')
}

/** 只留汉字与数字，并把异体字按住（标点、空白、拉丁字母一律不参与比对） */
const hanOnly = (s) =>
  s.replace(/[^\u3400-\u9fff0-9]/g, '').replace(/[\u3400-\u9fff]/g, (c) => VARIANTS[c] ?? c)

const cachePath = (name) => `${CACHE_DIR}/${name}`
const slug = (page) => page.replace(/[\\/:*?"<>|\s]/g, '_')

/**
 * 取一卷的正文（剥过维基标记的繁体原文），带磁盘缓存。
 * 返回 null 表示页面不存在。
 */
async function pageText(page) {
  const file = cachePath(`page_${slug(page)}.txt`)
  if (!REFRESH && existsSync(file)) {
    stats.pageHits += 1
    const cached = readFileSync(file, 'utf8')
    return cached === '\u0000MISSING' ? null : cached
  }
  const parsed = await get({ action: 'parse', page, prop: 'wikitext', redirects: '1' })
  await sleep(GAP)
  mkdirSync(CACHE_DIR, { recursive: true })
  if (parsed.error) {
    writeFileSync(file, '\u0000MISSING', 'utf8')
    return null
  }
  const text = stripWikitext(parsed.parse?.wikitext ?? '')
  writeFileSync(file, text, 'utf8')
  return text
}

/** 把我们的简体引文转成繁体（同一套 MediaWiki 转换表，方向反过来），按内容哈希缓存 */
async function toHant(text) {
  const key = createHash('sha1').update(text).digest('hex').slice(0, 16)
  const file = cachePath(`hant_${key}.txt`)
  if (!REFRESH && existsSync(file)) {
    stats.convHits += 1
    return readFileSync(file, 'utf8')
  }
  const conv = await get({ action: 'parse', text, contentmodel: 'wikitext', prop: 'text', variant: 'zh-hant' })
  await sleep(GAP)
  const out = stripHtml(conv.parse?.text ?? text)
  mkdirSync(CACHE_DIR, { recursive: true })
  writeFileSync(file, out, 'utf8')
  return out
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
  const text = await pageText(title)
  if (text === null) return null
  const found = locate(text, phrase)
  if (!found) return { title, missing: true }
  const from = Math.max(0, found.index - CTX)
  const to = Math.min(found.text.length, found.index + phrase.length + CTX)
  return {
    title,
    excerpt: found.text.slice(from, to).replace(/\s+/g, ' ').trim(),
    loose: Boolean(found.loose),
  }
}

/* --------------------------------------------------------------------------
   整本复查模式
   --------------------------------------------------------------------------
   判据：
     1. work 必须在 source-pages.json 里有页面映射（没映射就计入「跳过」，不装作通过）；
     2. 引文里用「……」缩略的，**每段都要逐字出现**，且先后顺序不能颠倒（挡断章拼句）；
     3. 页面里出现 ≠ 语义无误——但至少挡死「整句编造」和「张冠李戴到另一卷」。
   * ------------------------------------------------------------------------ */
if (QUOTES) {
  const pageMap = JSON.parse(readFileSync(opt('pages', 'scripts/data/source-pages.json'), 'utf8'))
  const quotes = JSON.parse(readFileSync(QUOTES, 'utf8'))
  const failures = []
  let ok = 0
  let bad = 0
  let skipped = 0

  for (const q of quotes) {
    const page = pageMap[q.work]
    if (!page) {
      skipped += 1
      console.log(`∅ ${q.id}｜无页面映射（work=${q.work}）`)
      continue
    }
    const rawText = await pageText(page)
    if (rawText === null) {
      bad += 1
      failures.push(`${q.id}｜页面不存在：${page}`)
      continue
    }
    const body = hanOnly(rawText)
    /* 顺序要紧：**先按省略号切段，再 hanOnly**。反过来会把省略号吃掉、两段粘成一段，
       于是所有带缩略的引文都被冤枉成「顺序不符」。 */
    const parts = (await toHant(q.text))
      .split(/…{2,}|\.{3,}/)
      .map(hanOnly)
      .filter(Boolean)
    let cursor = 0
    let broken = ''
    for (const part of parts) {
      const at = body.indexOf(part, cursor)
      if (at < 0) {
        broken = part
        break
      }
      cursor = at + part.length
    }
    if (broken) {
      bad += 1
      const head = broken.slice(0, 6)
      const at = body.indexOf(head)
      const hint =
        at >= 0
          ? `｜源文此处：${body.slice(at, at + Math.min(70, broken.length + 30))}`
          : '｜源文里连开头都找不到'
      failures.push(`${q.id}｜《${page}》：断在「${broken}」${hint}`)
      console.log(`✗ ${q.id} ← 《${page}》：断在「${broken.slice(0, 26)}…」${hint}`)
    } else {
      ok += 1
      console.log(`✓ ${q.id} ← 《${page}》（${parts.length} 段）`)
    }
  }

  console.log(`\n===== 机器复查：通过 ${ok} / 未通过 ${bad} / 无映射跳过 ${skipped}（共 ${quotes.length} 条）=====`)
  console.log(`请求 ${stats.requests} 次（卷缓存命中 ${stats.pageHits}，转换缓存命中 ${stats.convHits}）`)
  failures.forEach((f) => console.log('  ✗', f))
  console.log('「通过」只证明这段字在那卷里；缩略处的上下文、人物归属仍要人眼确认。')
  process.exit(bad ? 1 : 0)
}

/* --------------------------------------------------------------------------
   探针模式
   ------------------------------------------------------------------------ */
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
      if (hit?.missing) {
        console.log(`✗ ${label} | 指定页《${probe.page}》里没找到「${phrase}」（页码可能错，去掉 page 改全文检索）`)
        miss += 1
        continue
      }
      if (!hit) {
        console.log(`✗ ${label} | 页面不存在：《${probe.page}》`)
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
      const rank = (t) =>
        PRIMARY.some((p) => t.title.includes(p)) ? 0 : SECONDARY.some((p) => t.title.includes(p)) ? 2 : 1
      for (const h of [...hits].sort((a, b) => rank(a) - rank(b)).slice(0, 3)) {
        const r = await tryPage(h.title, phrase)
        if (r && !r.missing) {
          hit = r
          break
        }
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
console.log(`请求 ${stats.requests} 次（卷缓存命中 ${stats.pageHits}）`)
console.log('[一手] 只说明页面本身是正史/先秦文献；文字是否被后人窜改、归属是否正确，仍要自己读上下文判断。')
