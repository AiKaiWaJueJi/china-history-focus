/**
 * build-codex.mjs —— 生成全局百科库 src/data/codex.entries.json
 * ===========================================================================
 * 原则：**不新造史料**。条目全部从项目里已经逐条核对过的数据长出来：
 *
 *   · 战役（49）：endgame.*.json 的每个事件 —— 已有
 *       desc（名）、report（始末）、highlights（要点）、sourceText{bookName,text,translation}
 *     其中 text / translation 就是「文言原文 + 白话译文」，正好是抽屉要的两层。
 *
 *   · 人物（59）：endgame.*.json 的 figures —— 已有 bio（生平）、deeds（事迹）
 *   · 帝王（177）：emperors.*.json —— 谥号 / 本名 / 在位 / 要事 / 谥法本义
 *   · 诸侯（N）：lords.zhou.json —— 国 / 称号 / 本名 / 在位 / 称霸始末
 *   · 补充条目：scripts/data/codex.extra.json（人工写的典故 / 制度词条，可缺省）
 *
 * 正文里的 [[显示名|id]] 由两步产生：
 *   1. 人工在 codex.extra.json 里写死；
 *   2. 生成器按「全库人名 / 战役名」做最长优先匹配，自动织进正文。
 * 指向尚未收录的 id 也没关系——前端渲染成不可点的弱化文字，不会崩。
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'

const DATA = 'src/data'
const OUT = 'src/data/codex.entries.json'

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))

/** 「前230年」→ -230；「618年」→ 618；纯数字直接返回 */
const toYear = (v) => {
  if (typeof v === 'number') return v
  const text = String(v ?? '')
  const bc = text.includes('前')
  const n = Number(text.replace(/[^\d]/g, ''))
  if (!Number.isFinite(n)) return NaN
  return bc ? -n : n
}

/* -------------------------------------------------------------------------- */
/* 1. 战役                                                                     */
/* -------------------------------------------------------------------------- */
const battles = []
const usedIds = new Set()
/** figureId → 出现的战役 id 列表（反向索引，用来补 related） */
const figureToBattles = new Map()

const endgameFiles = readdirSync(DATA).filter((f) => /^endgame\..*\.json$/.test(f))
for (const file of endgameFiles) {
  const doc = readJson(`${DATA}/${file}`)
  const dynastyId = doc.dynastyId ?? null
  for (const ev of doc.events ?? []) {
    // id 唯一且稳定：撞车时补朝代后缀，同时保留 sourceId 供 UI 按「原事件 id」反查
    const id = usedIds.has(`bt_${ev.id}`) ? `bt_${ev.id}_${dynastyId ?? file.replace(/\W/g, '')}` : `bt_${ev.id}`
    usedIds.add(id)

    const lines = []
    if (ev.report) lines.push(ev.report)
    for (const h of ev.highlights ?? []) lines.push(`— ${typeof h === 'string' ? h : h.text}`)

    const quotes = []
    if (ev.sourceText?.text) {
      quotes.push({
        work: ev.sourceText.bookName ?? ev.sourceText.book ?? '',
        text: ev.sourceText.text,
        translation: ev.sourceText.translation ?? '',
      })
    }

    const figureIds = (ev.figures ?? []).map((f) => f.id)
    for (const fid of figureIds) {
      const list = figureToBattles.get(fid) ?? []
      list.push(id)
      figureToBattles.set(fid, list)
    }

    battles.push({
      id,
      // 战报事件 id 只在各自文件内唯一（楚汉与战国都有 e_han / e_wei …），
      // 所以对外用「朝代:事件 id」，UI 侧带 dynastyId 来查
      sourceId: `${dynastyId}:${ev.id}`,
      kind: 'battle',
      name: ev.desc ?? ev.target ?? id,
      subtitle: `${ev.year ?? ''}${doc.title ? ' · ' + doc.title : ''}`.trim(),
      years: String(ev.year ?? ''),
      dynastyId,
      body: lines.join('\n\n'),
      quotes,
      related: figureIds,
      tags: ['战役'],
      /** 仅生成期使用 */
      _year: toYear(ev.year),
      _figures: figureIds,
      _file: file,
      _atlas: ev.nationId ?? null,
    })
  }
}

/* -------------------------------------------------------------------------- */
/* 2. 人物                                                                     */
/* -------------------------------------------------------------------------- */
const characters = new Map()
for (const file of endgameFiles) {
  const doc = readJson(`${DATA}/${file}`)
  for (const ev of doc.events ?? []) {
    for (const fig of ev.figures ?? []) {
      const prev = characters.get(fig.id)
      const deeds = new Set([...(prev?.deeds ?? []), ...(fig.deeds ?? [])])
      characters.set(fig.id, {
        id: fig.id,
        sourceId: fig.id,
        kind: 'character',
        name: fig.name,
        subtitle: fig.title,
        dynastyId: doc.dynastyId ?? prev?.dynastyId ?? null,
        body: [fig.bio, ...[...deeds].map((d) => `— ${d}`)].filter(Boolean).join('\n\n'),
        quotes: [],
        related: [],
        tags: ['人物'],
        _deeds: [...deeds],
      })
    }
  }
}

for (const ch of characters.values()) {
  ch.related = (figureToBattles.get(ch.id) ?? []).slice(0, 6)
  /* 人物 id 也要登记：否则 5c 追加条目撞上同一个 id 时不会告警，直接产出重复条目 */
  usedIds.add(ch.id)
}

/* -------------------------------------------------------------------------- */
/* 3. 帝王                                                                     */
/* -------------------------------------------------------------------------- */
const emperors = []
const emperorFiles = readdirSync(DATA).filter((f) => /^emperors\..*\.json$/.test(f))
for (const file of emperorFiles) {
  const doc = readJson(`${DATA}/${file}`)
  const dynastyId = doc.dynastyId ?? null
  for (const e of doc.emperors ?? []) {
    if (usedIds.has(e.id)) continue
    usedIds.add(e.id)
    const lines = []
    // 在位年已经在标题下的 years 里，正文不再重复
    lines.push(`【谥法】${e.posthumousRule}`)
    if (e.events?.length) {
      lines.push('【要事】')
      for (const ev of e.events) lines.push(`— ${ev.name}${ev.year ? `（${ev.year}）` : ''}`)
    }
    /*
      在位期间的战事：**严格按在位年**，不宽放。
      早先放宽 20 年想把「即位居藩时打的仗」带上，结果漢惠帝（前195—前188）
      连前 202 年的垓下都链了进来——「同期」就不成立了，宁严勿滥。
    */
    const near = battles
      .filter((b) => Number.isFinite(b._year))
      .filter((b) => b._year >= e.startYear && b._year <= e.endYear)
      .sort((a, b) => b._year - a._year)
      .slice(0, 4)

    if (near.length) {
      lines.push('【在位战事】')
      for (const b of near) lines.push(`— [[${b.name}|${b.id}]]`)
    }

    /* 同朝前后主：保证每位帝王至少有一条出链，也方便顺着朝代往下读 */
    const siblings = (doc.emperors ?? []).map((x) => x.id)
    const pos = siblings.indexOf(e.id)
    const neighbours = [siblings[pos - 1], siblings[pos + 1]].filter(Boolean)
    if (neighbours.length) {
      lines.push('【同朝】')
      for (const nid of neighbours) {
        const sib = (doc.emperors ?? []).find((x) => x.id === nid)
        if (sib) lines.push(`— [[${sib.posthumousTitle}|${nid}]]`)
      }
    }

    emperors.push({
      id: e.id,
      sourceId: e.id,
      kind: 'emperor',
      name: e.posthumousTitle,
      subtitle: `${doc.name ?? ''} · 本名 ${e.personalName}`.replace(/^ · /, ''),
      alias: [e.personalName].filter(Boolean),
      years: e.reign,
      dynastyId,
      body: lines.join('\n'),
      quotes: [],
      related: [...near.map((b) => b.id), ...neighbours],
      tags: ['帝王'],
    })
  }
}

/* 南北朝 54 帝：数据源是 nanbei.json（五行并行时间轴），不在 emperors.*.json。
   2026-11-21 加：此前这 54 位没有百科条目，帝王卡点了没反应（十二朝那边是整卡入口）。
   原文线（codex.quotes.json）只覆盖十二朝正史本纪，所以这里标 quoteState='out-of-scope'——
   与「还没查完」（pending）区分开，UI 才不会把"没收录"说成"查过了没有"。 */
if (existsSync(`${DATA}/nanbei.json`)) {
  const nb = readJson(`${DATA}/nanbei.json`)
  const polityName = new Map((nb.polities ?? []).map((p) => [p.id, p.name]))
  const byPolity = new Map()
  for (const e of nb.emperors ?? []) {
    if (usedIds.has(e.id)) continue
    usedIds.add(e.id)
    const lines = [`【谥法】${e.posthumousRule ?? '（无）'}`]
    if (e.events?.length) {
      lines.push('【要事】')
      for (const ev of e.events) lines.push(`— ${ev.name}（${ev.year}）`)
    }
    const list = byPolity.get(e.polity) ?? []
    list.push(e)
    byPolity.set(e.polity, list)
  }
  for (const [polity, list] of byPolity) {
    list.forEach((e, i) => {
      const near = battles
        .filter((b) => Number.isFinite(b._year))
        .filter((b) => b._year >= e.start && b._year <= e.end)
        .slice(0, 3)
      const lines = [`【谥法】${e.posthumousRule ?? '（无）'}`, `【政权】${polityName.get(polity) ?? polity}`]
      if (e.events?.length) {
        lines.push('【要事】')
        for (const ev of e.events) lines.push(`— ${ev.name}（${ev.year}）`)
      }
      const neigh = [list[i - 1], list[i + 1]].filter(Boolean)
      if (neigh.length) {
        lines.push('【同政权】')
        for (const n of neigh) lines.push(`— [[${n.title}|${n.id}]]`)
      }
      emperors.push({
        id: e.id,
        sourceId: e.id,
        kind: 'emperor',
        name: e.title,
        subtitle: `${polityName.get(polity) ?? polity} · 本名 ${e.name}`,
        alias: [e.name].filter(Boolean),
        years: e.reign,
        dynastyId: 'southern_northern',
        body: lines.join('\n'),
        quotes: [],
        quoteState: 'out-of-scope',
        related: [...neigh.map((n) => n.id), ...near.map((b) => b.id)],
        tags: ['帝王', '南北朝'],
      })
    })
  }
}

/* -------------------------------------------------------------------------- */
/* 5. 十国（政权 + 君主）                                                       */
/* -------------------------------------------------------------------------- */
/*
  2026-11-21：十国原来只有「政权带」，读者点不出任何东西。
  现在一个政权一条 regime 条目（正文列该国君主，可继续下钻），
  每位君主一条 ruler 条目（不入中原帝系，所以不是 emperor）。
  原文线只覆盖十二朝正史本纪，所以君主条目标 quoteState='out-of-scope'。
*/
const regimes = []
if (existsSync(`${DATA}/ten_states.json`)) {
  const ten = readJson(`${DATA}/ten_states.json`)
  const wudai = existsSync(`${DATA}/wudai.json`) ? readJson(`${DATA}/wudai.json`) : { polities: [] }
  const polityById = new Map((wudai.polities ?? []).map((p) => [p.id, p]))

  for (const st of ten.states ?? []) {
    const p = polityById.get(st.polityId) ?? {}
    const lines = ['【十国】' + (p.note ?? st.polityName)]
    if (p.capital) lines.push(`【都城】${p.capital}`)
    if (p.fall) lines.push(`【亡国】${p.fall}`)
    lines.push('【君主】')
    for (const m of st.monarchs) lines.push(`— [[${m.title}|${m.id}]]（${m.reign}）`)
    if (p.relation) lines.push('【与中原】' + p.relation)

    regimes.push({
      id: `regime_${st.polityId}`,
      sourceId: st.polityId,
      kind: 'regime',
      name: st.polityName,
      subtitle: `十国 · ${st.monarchs.length} 位君主`,
      years: p.start && p.end ? `${p.start} — ${p.end}` : undefined,
      dynastyId: 'five_dynasties',
      body: lines.join('\n'),
      quotes: [],
      related: st.monarchs.map((m) => m.id),
      tags: ['十国', '政权'],
    })

    st.monarchs.forEach((m, i) => {
      if (usedIds.has(m.id)) return
      usedIds.add(m.id)
      const bodyLines = [`【谥法】${m.posthumousRule || '（无谥法）'}`, `【政权】${st.polityName}`]
      if (m.events?.length) {
        bodyLines.push('【在位要事】')
        for (const ev of m.events) bodyLines.push(`— ${ev.name}（${ev.year}）`)
      }
      const neigh = [st.monarchs[i - 1], st.monarchs[i + 1]].filter(Boolean)
      if (neigh.length) {
        bodyLines.push('【同国】')
        for (const n of neigh) bodyLines.push(`— [[${n.title}|${n.id}]]`)
      }
      emperors.push({
        id: m.id,
        sourceId: m.id,
        kind: 'ruler',
        name: m.title,
        subtitle: `${st.polityName} · 本名 ${m.name}`,
        alias: [m.name].filter(Boolean),
        years: m.reign,
        dynastyId: 'five_dynasties',
        body: bodyLines.join('\n'),
        quotes: [],
        quoteState: 'out-of-scope',
        related: [...neigh.map((n) => n.id), `regime_${st.polityId}`],
        tags: ['君主', '十国'],
      })
    })
  }
}

/* -------------------------------------------------------------------------- */
/* 5c. 宋辽金西夏（政权 + 君主）                                                */
/* -------------------------------------------------------------------------- */
/*
  2026-11-21：宋这一朝同时存在辽、西夏、金。单行时间轴读不出「同时还有谁」，
  另开一条并行视图（/dynasty/song/parallel）。
  宋的 18 位帝王仍是 emperor（早就在 emperors.song.json 里）；
  辽 / 西夏 / 金的 29 位君主是 ruler（不入宋的帝系），三家各一条 regime。
*/
const parallelRegimes = []
if (existsSync(`${DATA}/song_parallel.json`)) {
  const par = readJson(`${DATA}/song_parallel.json`)
  /*
    三家的原文状态不是一种东西（2026-11-23 从一档拆成三档）：
      · 辽、金 —— 有正史本纪，该收、只是还没核完 → to-collect（待收录）
      · 西夏   —— 正史无本纪，只有《宋史·夏国传》《辽史·西夏传》列传，凑一手语录只能转引
                  清人辑本，与「一手」口径冲突 → no-annals（无本纪，不收）
    新加政权（若将来再加）必须在这里显式登记；漏登记直接抛错，不许默认成「不在范围」。
  */
  const QUOTE_STATE_BY_POLITY = new Map([
    ['p_liao', 'to-collect'],
    ['p_jin', 'to-collect'],
    ['p_xixia', 'no-annals'],
  ])
  for (const p of par.polities ?? []) {
    const monarchs = (par.rulers ?? []).filter((r) => r.polityId === p.id).sort((a, b) => a.start - b.start)
    const lines = [`【政权】${p.name}（${p.start}—${p.end}）`]
    if (p.capital) lines.push(`【都城】${p.capital}`)
    if (p.leader) lines.push(`【开国】${p.leader}`)
    if (p.fall) lines.push(`【亡国】${p.fall}`)
    if (p.relation) lines.push('【与宋】' + p.relation)
    if (monarchs.length) {
      lines.push('【君主】')
      for (const m of monarchs) lines.push(`— [[${m.title}|${m.id}]]（${m.reign}）`)
    }
    parallelRegimes.push({
      id: `regime_${p.id}`,
      sourceId: p.id,
      kind: 'regime',
      name: p.name,
      subtitle: `宋辽金西夏 · ${monarchs.length} 位君主`,
      years: `${p.start} — ${p.end}`,
      dynastyId: 'song',
      body: lines.join('\n'),
      quotes: [],
      related: monarchs.map((m) => m.id),
      tags: ['宋辽金西夏', '政权'],
    })

    monarchs.forEach((m, i) => {
      if (usedIds.has(m.id)) return
      usedIds.add(m.id)
      const bodyLines = [`【谥法】${m.posthumousRule || '（无谥法）'}`, `【政权】${p.name}`]
      if (m.events?.length) {
        bodyLines.push('【在位要事】')
        for (const ev of m.events) bodyLines.push(`— ${ev.name}（${ev.year}）`)
      }
      const neigh = [monarchs[i - 1], monarchs[i + 1]].filter(Boolean)
      if (neigh.length) {
        bodyLines.push('【同国】')
        for (const n of neigh) bodyLines.push(`— [[${n.title}|${n.id}]]`)
      }
      const quoteState = QUOTE_STATE_BY_POLITY.get(p.id)
      if (!quoteState) throw new Error(`宋辽金西夏：政权 ${p.id} 未在 QUOTE_STATE_BY_POLITY 登记原文状态`)
      emperors.push({
        id: m.id,
        sourceId: m.id,
        kind: 'ruler',
        name: m.title,
        subtitle: `${p.name} · 本名 ${m.name}`,
        alias: [m.name].filter(Boolean),
        years: m.reign,
        dynastyId: 'song',
        body: bodyLines.join('\n'),
        quotes: [],
        quoteState,
        related: [...neigh.map((n) => n.id), `regime_${p.id}`],
        tags: ['君主', '宋辽金西夏'],
      })
    })
  }
}

/* -------------------------------------------------------------------------- */
/* 5b. 诸侯                                                                     */
/* -------------------------------------------------------------------------- */
const lords = []
if (existsSync(`${DATA}/lords.zhou.json`)) {
  const doc = readJson(`${DATA}/lords.zhou.json`)
  for (const l of doc.lords ?? []) {
    if (usedIds.has(l.id)) continue
    usedIds.add(l.id)
    const lines = [
      `【国】${l.state}`,
      l.hegemonyNote ? `【霸业】${l.hegemonyNote}（前 ${Math.abs(l.hegemonyStart)} — 前 ${Math.abs(l.hegemonyEnd)}）` : '',
    ].filter(Boolean)
    if (l.events?.length) {
      lines.push('【要事】')
      for (const ev of l.events) lines.push(`— ${ev.name}（${ev.year}）`)
    }
    lords.push({
      id: l.id,
      sourceId: l.id,
      kind: 'lord',
      name: l.title,
      subtitle: `${l.state} · 本名 ${l.personalName}`,
      alias: [l.personalName].filter(Boolean),
      years: l.reign,
      dynastyId: doc.dynastyId ?? null,
      body: lines.join('\n'),
      quotes: [],
      related: [],
      tags: ['诸侯'],
    })
  }
}

/* -------------------------------------------------------------------------- */
/* 5. 人工补充词条（可缺省）                                                    */
/* -------------------------------------------------------------------------- */
let extras = []
if (existsSync('scripts/data/codex.extra.json')) {
  extras = readJson('scripts/data/codex.extra.json')
  for (const e of extras) {
    if (usedIds.has(e.id)) console.warn(`⚠ 补充条目 id 重复，已跳过：${e.id}`)
  }
  extras = extras.filter((e) => !usedIds.has(e.id))
  for (const e of extras) usedIds.add(e.id)
}

/* -------------------------------------------------------------------------- */
/* 5c. 手写追加条目（人物 / 部族 / 战役补遗，可缺省）                             */
/* -------------------------------------------------------------------------- */
/*
  extras 是 kind:'extra' 的「典制」词条；这里允许**任意 kind**。
  用武之地：战报数据里只会出现「该战出场的人物」，而像冒顿单于、张良、魏徵
  这种贯穿型人物只能手写。body 里可以手写 [[显示名|id]]，也会参与后面的自动织链。
  原则不变：**一条一查，别批量造**。
*/
let appended = []
if (existsSync('scripts/data/codex.append.json')) {
  const raw = readJson('scripts/data/codex.append.json')
  for (const e of raw) {
    if (usedIds.has(e.id)) {
      console.warn(`⚠ 追加条目 id 重复，已跳过：${e.id}`)
      continue
    }
    usedIds.add(e.id)
    appended.push(e)
  }
  console.log(`✓ 追加条目并入 ${appended.length} 条`)
}

/* -------------------------------------------------------------------------- */
/* 5b. 文言原文（人工逐条查证，按条目 id 并入任意 kind）                          */
/* -------------------------------------------------------------------------- */
/*
  真源：scripts/data/codex.quotes.json（2026-11-18 起，取代只服务帝王的
  codex.emperor-quotes.json）。现在帝王 / 诸侯 / 典制共用这一个文件，
  将来人物原文也往这里加。

  为什么这里要**硬校验**（抛错而不是 warn）：原文是整个百科库最容易被编造的地方。
  「看起来像真的」的引文比没有更糟（docs/交接文档.md §9），所以：
    · work / text / translation 三件套缺一不可，缺了宁可生成不出来；
    · tier 只能是 primary（一手）或 secondary（类书/后世转引）；
    · secondary 必须写 via（转引链，如「《太平御览》卷 X 引，原书已佚」）——
      只写「转引」而不交代经过谁，等于没交代。
*/
const QUOTE_TIERS = new Set(['primary', 'secondary'])
if (existsSync('scripts/data/codex.quotes.json')) {
  const quotes = readJson('scripts/data/codex.quotes.json')
  const targets = new Map()
  for (const list of [battles, [...characters.values()], emperors, lords, extras, appended]) {
    for (const e of list) targets.set(e.id, e)
  }
  let merged = 0
  for (const q of quotes) {
    const target = targets.get(q.id)
    if (!target) {
      console.warn(`⚠ 原文找不到条目，已跳过：${q.id}`)
      continue
    }
    const missing = ['work', 'text', 'translation'].filter((f) => !q[f])
    if (missing.length) throw new Error(`原文缺字段 ${q.id}：${missing.join('/')}`)
    const tier = q.tier ?? 'primary'
    if (!QUOTE_TIERS.has(tier)) throw new Error(`原文 tier 非法 ${q.id}：${tier}`)
    if (tier === 'secondary' && !q.via) throw new Error(`转引原文必须写 via（转引链）：${q.id}`)
    const quote = { work: q.work, text: q.text, translation: q.translation, tier }
    if (q.via) quote.via = q.via
    target.quotes = [quote, ...(target.quotes ?? [])]
    merged += 1
  }
  console.log(`✓ 文言原文并入 ${merged} 条`)
}

/* -------------------------------------------------------------------------- */
/* 6. 自动织链：长名优先，已带标记的段落跳过                                      */
/* -------------------------------------------------------------------------- */
const all = [...battles, ...characters.values(), ...emperors, ...regimes, ...parallelRegimes, ...lords, ...extras, ...appended]
/*
  织链白名单：
    · 人物 / 战役 —— 直接用人名、战役名；
    · 帝王 / 诸侯 —— **只用本名**（嬴政、姜小白），不用「秦王」「齐桓公」这类称号。
  原因：本名是唯一的，而称号会撞语境——「王翦深知秦王猜忌」里的秦王是秦王政，
  按词面却会匹配到谥号叫「秦王」的子婴，链错人比不链更糟。
*/
const linkable = new Map()
const addLinkName = (name, id) => {
  if (!name || name.length < 2) return
  const prev = linkable.get(name)
  if (!prev || id.length < prev.length) linkable.set(name, id)
}
for (const e of all) {
  if (e.kind === 'character' || e.kind === 'battle' || e.kind === 'extra' || e.kind === 'event') addLinkName(e.name, e.id)
  else for (const n of e.alias ?? []) addLinkName(n, e.id)
}
const names = [...linkable.keys()].sort((a, b) => b.length - a.length)
const nameRe = new RegExp(names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g')

let linkCount = 0
for (const e of all) {
  if (!e.body) continue
  // 已被人工标记的片段先保护起来
  const parts = e.body.split(/(\[\[[^\]]+\]\])/g)
  e.body = parts
    .map((part) => {
      if (part.startsWith('[[')) return part
      return part.replace(nameRe, (m) => {
        const target = linkable.get(m)
        if (!target || target === e.id) return m
        linkCount += 1
        return `[[${m}|${target}]]`
      })
    })
    .join('')
}

/* -------------------------------------------------------------------------- */
/* 6b. 留白登记（codex.no-quote.json）                                          */
/* -------------------------------------------------------------------------- */
/*
  「查过、确实没有」和「还没查」在数据里长得一样，下一个人（或下一个 AI 会话）会把
  同一批帝王重查一遍。这里给前者发个牌子：noQuote + 理由。
  两条硬规矩：必须写理由；必须与 quotes 互斥（两边都写必然有一边是错的）。
*/
if (existsSync('scripts/data/codex.no-quote.json')) {
  const blanks = readJson('scripts/data/codex.no-quote.json')
  const byId = new Map(all.map((e) => [e.id, e]))
  let marked = 0
  for (const b of blanks) {
    const target = byId.get(b.id)
    if (!target) {
      console.warn(`⚠ 留白登记找不到条目：${b.id}`)
      continue
    }
    if (!b.reason || b.reason.length < 8) throw new Error(`留白登记必须写清理由：${b.id}`)
    if ((target.quotes ?? []).length) throw new Error(`留白登记与已有原文矛盾：${b.id}`)
    target.noQuote = b.reason
    marked += 1
  }
  console.log(`✓ 留白登记 ${marked} 位（查证过确实没有原文）`)
}

/* -------------------------------------------------------------------------- */
/* 7. 输出                                                                     */
/* -------------------------------------------------------------------------- */
for (const e of all) {
  delete e._figures
  delete e._file
  delete e._atlas
  delete e._deeds
  /*
    形状兜底：渲染层把 quotes / related 当数组直接 .map()。
    人工补充条目（codex.extra.json）本来只写 id/kind/name/body/related/tags，
    没有 quotes —— 第一版生成器漏了这一步，结果点「书同文」整棵树崩成黑屏。
    生成物必须**每条都齐四件**，缺一个字段就是一次白屏。
  */
  if (!Array.isArray(e.quotes)) e.quotes = []
  /* 老数据（战报的 sourceText）没有 tier，按一手处理；层级只决定 UI 小签 */
  for (const q of e.quotes) if (!q.tier) q.tier = 'primary'
  if (!Array.isArray(e.related)) e.related = []
  if (!Array.isArray(e.tags)) e.tags = []
  if (Array.isArray(e.alias) && e.alias.length === 0) delete e.alias
  if (typeof e.body !== 'string') e.body = ''
  if (typeof e.noQuote !== 'string' || !e.noQuote) delete e.noQuote
  /*
    状态与「有原文 / 有留白」互斥：收了原文或登记了留白的条目不该再挂 quoteState
    （金 10 位清零后若仍留着 out-of-scope，数据就自相矛盾了）。
  */
  if (e.noQuote || (Array.isArray(e.quotes) && e.quotes.length)) delete e.quoteState
  // 只保留真实存在的关联
  e.related = e.related.filter((rid) => rid !== e.id)
}

const countBy = (kind) => all.filter((e) => e.kind === kind).length

const payload = {
  generatedAt: 'scripts/build-codex.mjs',
  counts: {
    /* 按最终条目统计（含 5c 追加的人物），别用中间变量，否则 counts 会和 entries 对不上 */
    battle: countBy('battle'),
    character: countBy('character'),
    emperor: countBy('emperor'),
    ruler: countBy('ruler'),
    regime: countBy('regime'),
    lord: countBy('lord'),
    extra: countBy('extra'),
    event: countBy('event'),
    total: all.length,
  },
  entries: all,
}
writeFileSync(OUT, JSON.stringify(payload) + '\n', 'utf8')
console.log(
  `✓ ${OUT}\n  战役 ${payload.counts.battle} / 人物 ${payload.counts.character} / 帝王 ${payload.counts.emperor} / 君主 ${payload.counts.ruler} / 政权 ${payload.counts.regime} / 诸侯 ${payload.counts.lord} / 补充 ${payload.counts.extra}\n  合计 ${payload.counts.total} 条（事件 ${payload.counts.event}），自动织入 ${linkCount} 处链`,
)
