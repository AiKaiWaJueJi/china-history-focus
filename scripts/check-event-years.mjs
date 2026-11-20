/**
 * check-event-years.mjs —— 事件与帝王在位年的一致性检查（纯数据层，不联网）
 * ===========================================================================
 * 起因（2026-11-20）：人工写注解时发现「王子颓之乱」（前675）挂在**周庄王**名下，
 * 而庄王崩于前682——事件落在崩后七年，卡片标题与年份自相矛盾，页面上一眼可见。
 * 这类错机器一跑就出来，人肉读几十张卡反而不一定看得见。
 *
 * 三条判据：
 *   1. 事件年份必须落在帝王在位年之内（首尾各放宽 1 年，容即位年/崩年跨年记法）；
 *   2. 事件 id 全站唯一（注解表 `event-notes.json` 是**按 id 建键**的，
 *      两个帝王撞同一个 id 会共用一条注解，静默串味）；
 *   3. 每位帝王的事件按年份不要求有序（UI 会排），但年份必须是数字。
 *
 * 合法例外写进 ALLOW，**放行要留理由**——与 merge7 的白名单同一口径。
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'

const DIR = 'src/data'
const readJ = (f) => JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8'))

/**
 * 允许「事件年份在帝王在位年之外」的清单。键 = 事件 id，值 = 理由。
 * 只收**史实上确实发生在其即位之前、但属于该帝主线叙事**的事件（开国、背景）；
 * 不是用来掩盖归属错误的——归属错的事件要改数据，不是加进这里。
 */
const ALLOW = {
  ev_gao_yuefa: '前206 年入关约法三章，在称帝（前202）之前；这是漢室立国的起点，挂在高祖卡上是通行的叙事做法',
  /* ev_jingong_beifa 原在名单里：416 年的刘裕北伐挂在恭帝（418 即位）名下。
     批次 3 已把该事件移回晋安帝（义熙十二年正是安帝在位），故删掉这条放行——
     放行用完就该失效，留着会掩盖下一个同类错误。 */
  l_zhao_zhongshan: '前296 年灭中山：赵武灵王前299 传位惠文王、自称主父，灭中山在其主父任内完成，崩于前295；在位年字段只到传位年，故晚 3 年',
  /* 南北朝（nanbei.json）的四条：都是**开国/立国者在即位之前的本纪叙事**，
     也就是「他还没当皇帝时打的那一仗」。数据里没有"即位前"字段，事件只能记真实年份，
     所以放行——不是归属错，是叙事提前。 */
  ev_song_wu_1: '409 年灭南燕：刘裕 420 年才受禅建宋，这是他称帝前十年的事，记的是真实年份',
  ev_song_wu_2: '417 年灭后秦：同上，刘裕北伐收复两京在称帝之前，是他受禅的本钱',
  ev_liang_jianwen_2: '540 年宫体诗风：萧纲 549 年即位，宫体诗是他做太子时的事，属"其人其事"而非"其政"',
  ev_chen_wu_1: '552 年讨平侯景：陈霸先 557 年受禅建陈，讨侯景是他起家的战功',
}
const problems = []
const allowed = []
let events = 0

const files = readdirSync(DIR).filter((f) => /^(emperors|lords)\..*\.json$/.test(f))
const seen = new Map()

/** 一份数据里所有人物的检查（帝王/诸侯是一组字段，南北朝是 start/end + title） */
function scan(rows, label) {
  for (const who of rows) {
    const start = who.startYear ?? who.start
    const end = who.endYear ?? who.end
    for (const ev of who.events ?? []) {
      events += 1
      const where = `${who.id}/${ev.id}`
      if (seen.has(ev.id)) problems.push(`事件 id 撞车：${ev.id} 同时出现在 ${seen.get(ev.id)} 与 ${where}`)
      else seen.set(ev.id, where)

      if (typeof ev.year !== 'number' || Number.isNaN(ev.year)) {
        problems.push(`${where} 的 year 不是数字：${ev.year}`)
        continue
      }
      if (typeof start !== 'number' || typeof end !== 'number') continue
      const out = ev.year < start - 1 || ev.year > end + 1
      if (!out) continue
      if (ALLOW[ev.id]) {
        allowed.push(`${where}｜${ev.year}｜${ALLOW[ev.id]}`)
        continue
      }
      problems.push(`${where}「${ev.name}」(${ev.year}) 落在 ${who.posthumousTitle ?? who.title ?? who.id} 在位年 ${start}..${end} 之外`)
    }
  }
  console.log(`   · ${label}`)
}

for (const f of files) {
  const doc = readJ(f)
  scan(Array.isArray(doc) ? doc : doc.emperors ?? doc.lords ?? [], f)
}
/* 南北朝 54 帝在 nanbei.json（多行并行时间轴的独立数据源），2026-11-21 起一并检查 */
if (existsSync(`${DIR}/nanbei.json`)) scan(readJ('nanbei.json').emperors ?? [], 'nanbei.json（南北朝）')
/* 十国 41 位君主在 ten_states.json（政权带 → 君主 → 档案），同样检查 */
if (existsSync(`${DIR}/song_parallel.json`)) {
  const par = readJ('song_parallel.json')
  scan(par.rulers ?? [], 'song_parallel.json（宋辽金西夏君主）')
}
if (existsSync(`${DIR}/ten_states.json`)) {
  const ten = readJ('ten_states.json')
  const rows = (ten.states ?? []).flatMap((st) => st.monarchs ?? [])
  scan(rows, 'ten_states.json（十国君主）')
}

console.log(`检查 ${files.length} 份数据、${events} 条事件`)
if (allowed.length) {
  console.log(`\n合法例外 ${allowed.length} 条（ALLOW 白名单）：`)
  allowed.forEach((a) => console.log('  · ' + a))
}
if (problems.length) {
  console.log(`\n✗ 发现 ${problems.length} 处问题：`)
  problems.forEach((p) => console.log('  ✗ ' + p))
  process.exit(1)
}
console.log('\n✓ 全部事件都落在所属帝王/诸侯的在位年之内，事件 id 全站唯一')
