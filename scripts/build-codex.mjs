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
    lines.push(`【谥法】${e.posthumousRule}`)
    lines.push(`【在位】${e.reign}`)
    if (e.events?.length) {
      lines.push('【要事】')
      for (const ev of e.events) lines.push(`— ${ev.name}${ev.year ? `（${ev.year}）` : ''}`)
    }
    // 在位前后（放宽 20 年，覆盖即位前以「秦王」「晋王」身份打的仗）的战事，最多 4 条
    const near = battles
      .filter((b) => Number.isFinite(b._year))
      .filter((b) => b._year >= e.startYear - 20 && b._year <= e.endYear)
      .sort((a, b) => Math.abs(a._year - e.startYear) - Math.abs(b._year - e.startYear))
      .slice(0, 4)

    if (near.length) {
      lines.push('【同期战事】')
      for (const b of near) lines.push(`— [[${b.name}|${b.id}]]`)
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
      related: near.map((b) => b.id),
      tags: ['帝王'],
    })
  }
}

/* -------------------------------------------------------------------------- */
/* 4. 诸侯                                                                     */
/* -------------------------------------------------------------------------- */
const lords = []
if (existsSync(`${DATA}/lords.zhou.json`)) {
  const doc = readJson(`${DATA}/lords.zhou.json`)
  for (const l of doc.lords ?? []) {
    if (usedIds.has(l.id)) continue
    usedIds.add(l.id)
    const lines = [
      `【国】${l.state}`,
      `【在位】${l.reign}`,
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
/* 6. 自动织链：长名优先，已带标记的段落跳过                                      */
/* -------------------------------------------------------------------------- */
const all = [...battles, ...characters.values(), ...emperors, ...lords, ...extras]
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
  if (e.kind === 'character' || e.kind === 'battle' || e.kind === 'extra') addLinkName(e.name, e.id)
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
/* 7. 输出                                                                     */
/* -------------------------------------------------------------------------- */
for (const e of all) {
  delete e._figures
  delete e._file
  delete e._atlas
  delete e._deeds
  if (!e.related) e.related = []
  // 只保留真实存在的关联
  e.related = e.related.filter((rid) => rid !== e.id)
}

const payload = {
  generatedAt: 'scripts/build-codex.mjs',
  counts: {
    battle: battles.length,
    character: characters.size,
    emperor: emperors.length,
    lord: lords.length,
    extra: extras.length,
    total: all.length,
  },
  entries: all,
}
writeFileSync(OUT, JSON.stringify(payload) + '\n', 'utf8')
console.log(
  `✓ ${OUT}\n  战役 ${payload.counts.battle} / 人物 ${payload.counts.character} / 帝王 ${payload.counts.emperor} / 诸侯 ${payload.counts.lord} / 补充 ${payload.counts.extra}\n  合计 ${payload.counts.total} 条，自动织入 ${linkCount} 处链`,
)
