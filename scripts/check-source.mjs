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

const QUOTES = opt('quotes', '')
if (!probePath && !QUOTES) {
  console.error('用法：node scripts/check-source.mjs probes.json [--context=190] [--gap=2000]')
  console.error(
    '  或：node scripts/check-source.mjs --quotes=scripts/data/codex.quotes.json [--pages=scripts/data/source-pages.json]',
  )
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

/**
 * HTML（MediaWiki 的 variant=zh-hans 解析输出）→ 纯文本。
 *
 * 为什么要用 HTML 而不是 wikitext：本项目原文统一用**简体**，维基文库正文是**繁体**，
 * 逐字比对必然全红。MediaWiki 自带繁简转换（variant=zh-hans），拿它转换后的正文来比，
 * 才能既保住「逐字」这个强度、又不用在本地引一套繁简表。
 * 顺带去掉 <sup> 脚注号——它会在句中插一个数字，把连续的句子切断。
 */
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

/**
 * 异体字归一表。
 *
 * 为什么需要：繁简转换不负责「异体字对」（羣/群、於/于、彊/强、兾/冀、卽/即……），
 * 维基文库又常照底本保留古字，于是会出现「同一句话两边都写着，字面却不同」。
 * 这只影响**比对**，不改数据：引文照项目统一用简体，页面的古字留在原处。
 * 新失败大多是这里缺一条——看到「源文此处」输出，把那一对补进来即可。
 */
const VARIANTS = {
  羣: '群', 卽: '即', 內: '内', 於: '于', 兾: '冀', 柰: '奈', 鬬: '斗', 鬥: '斗', 犇: '奔',
  慍: '愠', 讎: '仇', 屍: '尸', 臺: '台', 虛: '虚', 眞: '真', 敍: '叙', 爲: '为', 嚮: '向',
  徳: '德', 敎: '教', 旣: '既', 衆: '众', 恥: '耻', 閒: '间', 彊: '强', 寛: '宽', 郞: '郎',
  製: '制', 衞: '卫', 衛: '卫', 灋: '法', 愼: '慎', 曁: '暨', 冊: '册', 麤: '粗',
  /* 强/強/彊 三体同字：源文常作「彊」，繁转简可能给「強」，我们写「强」——两边都按住 */
  強: '强', 彊: '强', 仆: '仆', 僕: '仆',
  煑: '煮', 昬: '昏', 睠: '眷', 慙: '惭', 眎: '视', 祇: '只', 弃: '弃', 冨: '富', 槩: '概',
  廼: '乃', 迺: '乃', 甯: '宁', 絜: '洁', 澹: '淡', 缾: '瓶', 鉅: '巨', 欵: '款', 宻: '密',
}

/** 只留汉字与数字，并把异体字按住（标点、空白、拉丁字母一律不参与比对） */
const hanOnly = (s) =>
  s
    .replace(/[^\u3400-\u9fff0-9]/g, '')
    .replace(/[\u3400-\u9fff]/g, (c) => VARIANTS[c] ?? c)

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

/* --------------------------------------------------------------------------
   复查模式：把整本 codex.quotes.json 丢进来，逐条回原书核对
   --------------------------------------------------------------------------
   判据三条：
     1. 该条的 work 必须在 source-pages.json 里有页面映射（没映射就跳过并计入「跳过」，不装作通过）；
     2. 原文里用「……」缩略的，**每一段都要逐字出现**，且先后顺序不能颠倒（防止断章拼句）；
     3. 页面里出现 ≠ 语义无误——但至少能挡死「整句编造」和「张冠李戴到另一卷」。
   * ------------------------------------------------------------------------ */
if (QUOTES) {
  const mapPath = opt('pages', 'scripts/data/source-pages.json')
  const pageMap = JSON.parse(readFileSync(mapPath, 'utf8'))
  const quotes = JSON.parse(readFileSync(QUOTES, 'utf8'))
  let ok = 0
  let bad = 0
  let skipped = 0
  const failures = []

  for (const q of quotes) {
    const page = pageMap[q.work]
    if (!page) {
      skipped += 1
      console.log(`∅ ${q.id}｜无页面映射（work=${q.work}）`)
      continue
    }
    /*
      比对策略（踩过两轮才定下来）：
        1. 页面取 **wikitext 原文**（繁体，未经任何转换）——维基文库的 zh-hans 转换是
           残的：有的段落留在繁体（術、於、羣），有的转成简体，做基准不可靠；
        2. 我们自己的引文是简体，先用 MediaWiki 转成 zh-hant 再比（同一套转换表，方向反过来）；
        3. 两边都**只留汉字与数字**：标点不参与比对。理由：维基 zh-hans 会把「」转成“”，
           各家标点习惯也不同；比标点只会把「摘录时统一了引号」误判成「引文造假」。
           比字就够了——错字、漏句、断章拼句都会现形。
    */
    const parsed = await get({ action: 'parse', page, prop: 'wikitext', redirects: '1' })
    if (parsed.error) {
      bad += 1
      failures.push(`${q.id}｜页面不存在：${page}`)
      await sleep(GAP)
      continue
    }
    const body = hanOnly(stripWikitext(parsed.parse?.wikitext ?? ''))
    const converted = await get({
      action: 'parse',
      text: q.text,
      contentmodel: 'wikitext',
      prop: 'text',
      variant: 'zh-hant',
    })
    await sleep(GAP)
    /* 注意顺序：**先按省略号切段，再 hanOnly**。
       早先反过来写，hanOnly 会把「……」也当标点删掉，两段粘成一段，
       于是凡是带缩略的引文都被冤枉成「顺序不符」。 */
    const raw = stripHtml(converted.parse?.text ?? q.text)
    const parts = raw
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
      /* 定位失败时把「源文长什么样」一并打出来：
         绝大多数不一致不是编造，而是异体字（兾/冀、柰/奈）、引号样式（「」/『』）、
         以及我们自己在句末补的标点。看得到源文才能判断该改谁。 */
      const head = broken.slice(0, 6)
      const at = body.indexOf(head)
      const hint = at >= 0 ? `｜源文此处：${body.slice(at, at + Math.min(70, broken.length + 30))}` : '｜源文里连开头都找不到'
      failures.push(`${q.id}｜《${page}》：断在「${broken}」${hint}`)
      console.log(`✗ ${q.id} ← 《${page}》：断在「${broken.slice(0, 26)}…」${hint}`)
    } else {
      ok += 1
      console.log(`✓ ${q.id} ← 《${page}》（${parts.length} 段）`)
    }
    await sleep(GAP)
  }

  console.log(`\n===== 机器复查：通过 ${ok} / 未通过 ${bad} / 无映射跳过 ${skipped}（共 ${quotes.length} 条）=====`)
  failures.forEach((f) => console.log('  ✗', f))
  console.log('「通过」只证明这段字在那卷里；缩略处的上下文、人物归属仍要人眼确认。')
  process.exit(bad ? 1 : 0)
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
