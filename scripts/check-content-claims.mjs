/**
 * check-content-claims.mjs —— 生平文本里的「可计算断言」与数据的一致性检查（纯数据层，不联网）
 * ===========================================================================
 * 起因（2026-11-20 夜）：764 条事件注解 + 301 条生平是分 8 个批次批量写的，
 * 机器此前只守住了「形状」与「事件年份」两件事（check-event-years），正文里说的史实一句没验。
 * 事件注解基本不写年份（年份在元数据里），所以「对年份」这条路走不通；
 * 但**生平里有大量可计算的断言**——「在位五年」「第二位皇帝」「559 年暴卒」——
 * 这些是机器能对、而且错了读者一眼就看得见的。
 *
 * 四条判据：
 *   1. 「在位N年」必须与数据里的 start/end 之差相符（容 1 年：即位年 / 崩年跨年记法）；
 *   2. 同一政权内「第N位」不得重复——最典型的批量错法是少算一位，
 *      于是两个君主都自称「第三位」（楚 马希范 / 马希广 就是这么撞的，见 2026-11-21 修）；
 *   3. 「第N位」与**本政权内数据序号**的偏移必须一致：数据只收某段历史窗口内的君主
 *      （北魏从明元帝起收录，道武帝不在 420—589 窗口里），所以「北魏第二位皇帝」对应本政权
 *      第 1 条数据，偏移 +1 是**正确**的；一个政权内所有人共享同一偏移，**偏离众数的那个才可疑**；
 *   4. 生平里出现的绝对年份必须落在 [start-40, end+20]：前者容「追述父祖开国」，
 *      后者容「逊位 / 降封后的卒年」（后周恭帝 960 年禅位、973 年卒于房州）。
 *
 * 政权键必须带数据源前缀：南北朝有个「宋」（刘宋），赵宋也叫「宋」，
 * 只按名字分组会让两个宋的序号互相污染（第一版就是这么把自己的断言搞红的）。
 *
 * 合法例外写进 ALLOW（键 = `人物id|规则`），**放行必须留理由**——与 check-event-years 同一口径。
 */
import { readFileSync, readdirSync } from 'node:fs'

const DIR = 'src/data'
const readJ = (f) => JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8'))
const notes = readJ('event-notes.json')
const bios = readJ('emperor-bios.json')

/**
 * 放行的断言。键 = `人物id|规则`，值 = 理由。
 * 只收**史实本身没错、只是口径不同**的；真错的要改数据，不是加进来。
 */
const ALLOW = {
  'han_ping|reign': '漢平帝 前1—6，数据按卒年记到 6，生平「在位五年」数的是元始一至五年（跨年记法差 2 年），两者都对',
}

/* ---------- 1. 人物索引：按「数据源+政权」分组，记本政权内序号 ---------- */
/** @type {{id:string,label:string,polity:string,group:string,start:number,end:number,order:number}[]} */
const rulers = []
const byPolity = new Map()

function addPolity(group, polity, list, startKey, endKey) {
  const key = `${group}|${polity}`
  const bucket = byPolity.get(key) ?? []
  list.forEach((who) => {
    const row = {
      id: who.id,
      label: who.posthumousTitle ?? who.title ?? who.id,
      polity,
      group,
      start: who[startKey] ?? who.startYear,
      end: who[endKey] ?? who.endYear,
      order: bucket.length + 1,
    }
    bucket.push(row)
    rulers.push(row)
  })
  byPolity.set(key, bucket)
}

for (const f of readdirSync(DIR).filter((f) => /^emperors\..*\.json$/.test(f))) {
  const doc = readJ(f)
  addPolity(f, doc.name, doc.emperors ?? [], 'startYear', 'endYear')
}

const nanbei = readJ('nanbei.json')
const nbPolityName = new Map((nanbei.polities ?? []).map((p) => [p.id, p.name]))
const nbByPolity = new Map()
for (const who of nanbei.emperors ?? []) {
  const name = nbPolityName.get(who.polity) ?? who.polity
  const list = nbByPolity.get(name) ?? []
  list.push(who)
  nbByPolity.set(name, list)
}
for (const [name, list] of nbByPolity) addPolity('nanbei.json', name, list, 'start', 'end')

const parallel = readJ('song_parallel.json')
for (const p of parallel.polities ?? []) {
  addPolity(
    'song_parallel.json',
    p.name,
    (parallel.rulers ?? []).filter((r) => r.polityId === p.id),
    'start',
    'end',
  )
}
for (const st of readJ('ten_states.json').states ?? []) {
  addPolity('ten_states.json', st.polityName ?? st.polityId, st.monarchs ?? [], 'start', 'end')
}

const rulerById = new Map(rulers.map((r) => [r.id, r]))

/* ---------- 2. 文本解析 ---------- */
const CN = { 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
/** 中文数字 → 整数（只处理「一」到「九十九」；生平的断言不会更大） */
function cn2num(s) {
  if (!s) return null
  if (s === '十') return 10
  const [hi, lo] = s.split('十')
  if (lo === undefined) return CN[s] ?? null
  const tens = hi ? CN[hi] : 1
  const ones = lo ? CN[lo] : 0
  return tens === undefined || ones === undefined ? null : tens * 10 + ones
}

/** 抽文本里的公历年份（负数为公元前），只认「前 123 年 / 123 年」 */
const YEAR_RE = /(前\s*)?(\d{1,4})\s*年/g
const yearsIn = (text) => [...String(text).matchAll(YEAR_RE)].map((m) => (m[1] ? -Number(m[2]) : Number(m[2])))

/* ---------- 3. 断言收集 ---------- */
let pass = 0
let fail = 0
const check = (name, ok, detail = '') => {
  if (ok) pass += 1
  else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' :: ' + detail : ''}`)
}

const bioIds = Object.keys(bios).filter((k) => k !== '_readme')
check(
  '每位人物都有生平',
  bioIds.length === rulers.length && bioIds.every((id) => rulerById.has(id)),
  `生平 ${bioIds.length} / 人物 ${rulers.length}`,
)

const reignClaims = []
const ordinalClaims = []
const yearHits = []
let bioWithClaim = 0

for (const id of bioIds) {
  const text = bios[id]
  const who = rulerById.get(id)
  if (!who) continue
  let claimed = false

  for (const m of text.matchAll(/在位\s*([一二三四五六七八九十]{1,3})\s*年/g)) {
    const claim = cn2num(m[1])
    claimed = true
    if (claim === null) continue
    reignClaims.push({ id, who, claim, real: Math.abs(who.end - who.start), raw: m[0] })
  }
  /* 「第N位」与「第N任」是同一种断言（十国的生平两种措辞混用），一并收 */
  for (const m of text.matchAll(/第\s*([一二三四五六七八九十]{1,3})\s*[位任]/g)) {
    const claim = cn2num(m[1])
    claimed = true
    if (claim === null) continue
    ordinalClaims.push({ id, who, claim, raw: m[0] })
  }
  if (claimed) bioWithClaim += 1

  for (const y of yearsIn(text)) {
    if (y < who.start - 40 || y > who.end + 20) yearHits.push({ id, who, y, text: text.slice(0, 120) })
  }
}

/* ---------- 4. 判据 1：在位年数 ---------- */
const reignBad = reignClaims.filter((c) => Math.abs(c.claim - c.real) > 1 && !ALLOW[`${c.id}|reign`])
check(
  '「在位N年」与 start..end 相符',
  reignBad.length === 0,
  reignBad.map((c) => `${c.who.polity}/${c.who.label} ${c.raw}=${c.claim} 数据 ${c.who.start}..${c.who.end}=${c.real}`).join('；'),
)

/* ---------- 5. 判据 2：同政权内序号不重复 ---------- */
const dupByPolity = new Map()
for (const c of ordinalClaims) {
  const key = `${c.who.group}|${c.who.polity}`
  const seen = dupByPolity.get(key) ?? new Map()
  const list = seen.get(c.claim) ?? []
  list.push(c)
  seen.set(c.claim, list)
  dupByPolity.set(key, seen)
}
const dupBad = []
for (const [key, seen] of dupByPolity) {
  for (const [, list] of seen) {
    if (list.length > 1) dupBad.push(`${key.replace('|', '/')} 有 ${list.length} 人同称第 ${list[0].claim}${list[0].raw.at(-1)}：${list.map((c) => c.who.label).join(' / ')}`)
  }
}
check('同一政权内「第N位」不重复', dupBad.length === 0, dupBad.join('；'))

/* ---------- 6. 判据 3：偏移量一致（偏离本政权众数即可疑） ---------- */
const offsetByPolity = new Map()
for (const c of ordinalClaims) {
  const key = `${c.who.group}|${c.who.polity}`
  const offsets = offsetByPolity.get(key) ?? new Map()
  const off = c.claim - c.who.order
  offsets.set(off, (offsets.get(off) ?? 0) + 1)
  offsetByPolity.set(key, offsets)
}
const modeOffset = new Map()
for (const [key, offsets] of offsetByPolity) {
  let best = 0
  let bestCount = -1
  for (const [off, count] of offsets) {
    if (count > bestCount) {
      best = off
      bestCount = count
    }
  }
  modeOffset.set(key, best)
}
const ordinalBad = ordinalClaims.filter(
  (c) => c.claim - c.who.order !== modeOffset.get(`${c.who.group}|${c.who.polity}`),
)
check(
  '「第N位」与本政权内数据序号的偏移一致',
  ordinalBad.length === 0,
  ordinalBad
    .map((c) => `${c.who.polity}/${c.who.label} ${c.raw}=${c.claim} 数据第 ${c.who.order} 位，本政权偏移众数 ${modeOffset.get(`${c.who.group}|${c.who.polity}`)}`)
    .join('；'),
)

/* ---------- 7. 判据 4：生平里的绝对年份不越界 ---------- */
check(
  '生平里的年份落在 [start-40, end+20]',
  yearHits.length === 0,
  yearHits.map((h) => `${h.who.polity}/${h.who.label}(${h.who.start}..${h.who.end}) 出现 ${h.y}`).join('；'),
)

/* ---------- 8. 覆盖率自证：这些数字进了汇报，别让工具悄悄变空 ---------- */
check('生平里含可计算断言的人数 ≥ 100', bioWithClaim >= 100, `${bioWithClaim} 人`)
check('「在位N年」断言 ≥ 60 处', reignClaims.length >= 60, `${reignClaims.length} 处`)
check('「第N位」断言 ≥ 40 处', ordinalClaims.length >= 40, `${ordinalClaims.length} 处`)
check('生平条数 = 301', bioIds.length === 301, `${bioIds.length} 条`)
check('注解条数 = 764', Object.keys(notes).length - 1 === 764, `${Object.keys(notes).length - 1} 条`)

console.log(
  `\n扫过 ${bioIds.length} 条生平 / ${rulers.length} 位人物：有断言 ${bioWithClaim} 人，「在位N年」${reignClaims.length} 处、「第N位」${ordinalClaims.length} 处、绝对年份 ${yearHits.length} 处`,
)
const allowed = reignClaims.filter((c) => ALLOW[`${c.id}|reign`])
if (allowed.length) {
  console.log(`\n合法例外 ${allowed.length} 条（ALLOW 白名单）：`)
  for (const x of allowed) console.log(`  · ${x.who.polity}/${x.who.label}｜${ALLOW[`${x.id}|reign`]}`)
}

console.log(`\n===== ${pass}/${pass + fail} passed =====`)
if (fail) process.exitCode = 1
