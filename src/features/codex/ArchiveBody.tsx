/**
 * ArchiveBody —— 帝王 / 诸侯档案的结构化正文（替代原来的纯文本 body）
 * ===========================================================================
 * 设计取舍：
 *   · **全量事件**：档案里把这批事件一次列完（时间轴 hover 只铺得下几条），按年份升序；
 *   · **点击展开**：每一行都能点开详情——年份 / 类别 / 时代 / 史实注解 /
 *     同期在任诸侯 / 相关档案下钻，一条事件不再只是「名字 + 年份」；
 *   · **不造史实**：注解来自 event-notes.json，没写注解的事件退回元数据，
 *     并在头部如实标出「注解 N / 共 M」。
 */
import { useState } from 'react'
import type { CodexEntry } from '../../core/codex'
import { formatYear, getEmperorArchive, getLordArchive } from '../../data/emperorData'
import {
  DIMENSION_LABEL,
  buildEventTimeline,
  entryForEventName,
  getEmperorBio,
  getEventNote,
  getEmperorTagline,
  linkify,
  type EventDetail,
} from '../../data/archive'
import { RichText } from './RichText'

interface ArchiveBodyProps {
  entry: CodexEntry
  onDrill: (id: string) => void
}

const EVAL_LABEL = { good: '美谥', neutral: '平谥', bad: '恶谥' } as const

function EventItem({
  detail,
  open,
  onToggle,
  onDrill,
}: {
  detail: EventDetail
  open: boolean
  onToggle: () => void
  onDrill: (id: string) => void
}) {
  const { event, note, entry, rulers, segment } = detail
  return (
    <li className={`codex-event-item${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="codex-event"
        onClick={onToggle}
        aria-expanded={open}
        data-dimension={event.dimension}
      >
        <span className="codex-event-year">{formatYear(event.year)}</span>
        <span className="codex-event-dot" aria-hidden="true" />
        <span className="codex-event-name">{event.name}</span>
        <span className="codex-event-dim">{DIMENSION_LABEL[event.dimension] ?? event.dimension}</span>
        <span className="codex-event-caret" aria-hidden="true">
          {open ? '−' : '+'}
        </span>
      </button>

      {open ? (
        <div className="codex-event-detail">
          {note ? (
            /* 注解里的词条名会被 linkify 织成可点链接（「韩信」「冒顿单于」这类） */
            <div className="codex-event-note-wrap">
              <RichText text={linkify(note)} onDrill={onDrill} />
            </div>
          ) : (
            <p className="codex-event-note codex-event-note--empty">
              这一条还没有查证过的注解，先看它的时间、类别与同期人物。
            </p>
          )}

          <dl className="codex-event-meta">
            <div>
              <dt>年份</dt>
              <dd>
                {formatYear(event.year)}
                {segment ? ` · ${segment}` : ''}
              </dd>
            </div>
            <div>
              <dt>类别</dt>
              <dd>{DIMENSION_LABEL[event.dimension] ?? event.dimension}</dd>
            </div>
          </dl>

          {rulers.length ? (
            <div className="codex-event-block">
              <span className="codex-event-block-label">同年称霸</span>
              <div className="codex-event-chips">
                {rulers.slice(0, 4).map((lord) => (
                  <button
                    key={lord.id}
                    type="button"
                    className="codex-chip"
                    onClick={() => onDrill(lord.id)}
                  >
                    <em>{lord.state}</em>
                    {lord.title}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {entry ? (
            <div className="codex-event-block">
              <span className="codex-event-block-label">相关档案</span>
              <button type="button" className="codex-link" onClick={() => onDrill(entry.id)}>
                {entry.name}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

function EventTimeline({
  details,
  openIds,
  onToggle,
  onDrill,
}: {
  details: EventDetail[]
  openIds: Set<string>
  onToggle: (id: string) => void
  onDrill: (id: string) => void
}) {
  return (
    <ol className="codex-event-list">
      {details.map((detail) => (
        <EventItem
          key={detail.event.id}
          detail={detail}
          open={openIds.has(detail.event.id)}
          onToggle={() => onToggle(detail.event.id)}
          onDrill={onDrill}
        />
      ))}
    </ol>
  )
}

export function ArchiveBody({ entry, onDrill }: ArchiveBodyProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set())
  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const id = entry.sourceId ?? entry.id

  /* ---------------- 帝王 / 十国君主 ---------------- */
  const emperorRefIsRuler = entry.kind === 'ruler'
  const emperorRef = entry.kind === 'emperor' || entry.kind === 'ruler' ? getEmperorArchive(id) : null
  if (emperorRef) {
    const { emperor, dynastyName, prev, next, index, total, segments } = emperorRef
    /* 所属时代（西周 / 东周…）与段内标志点（春秋 / 战国）：给初学者一个坐标 */
    const era = segments.find((seg) => seg.id === emperor.segmentId)
    const eraMarker = [...(era?.markers ?? [])]
      .sort((a, b) => a.year - b.year)
      .filter((marker) => emperor.startYear >= marker.year)
      .pop()
    const timeline = buildEventTimeline(id)
    const annotated = timeline.filter((item) => item.note).length
    const bio = getEmperorBio(id)
    const tagline = getEmperorTagline(id)
    /* 十国君主不是「朝」而是「国」——标签上用词必须跟着身份走 */
    const unit = emperorRefIsRuler ? '本国' : '本朝'
    /* 在位年数：含首尾（前1046—前1043 记作 4 年） */
    const reignYears = emperor.endYear - emperor.startYear + 1

    return (
      <div className="codex-archive">
        <div className="codex-archive-head">
          <span className="codex-archive-dynasty">{dynastyName}</span>
          <span className="codex-archive-reign">
            在位 {reignYears} 年 · {unit}第 {index} / {total} 位
          </span>
          <span className={`codex-eval is-${emperor.evaluation}`}>
            {EVAL_LABEL[emperor.evaluation]}
          </span>
          {tagline ? <span className="codex-archive-tag">{tagline}</span> : null}
        </div>

        {/* 没有单字谥法就不摆这一行：辽制用尊号，十国与南北朝的多数君主无谥。
            「谥法 （无谥法）」这种占位自相矛盾，宁可不显示。 */}
        {emperor.posthumousRule && !emperor.posthumousRule.startsWith('（') ? (
          <p className="codex-archive-rule">
            <span>谥法</span>
            {emperor.posthumousRule}
          </p>
        ) : null}

        {era ? (
          <p className="codex-archive-rule codex-archive-era">
            <span>时代</span>
            {era.name}
            {era.desc ? ` · ${era.desc}` : ''}
            {eraMarker ? ` · ${eraMarker.name}${eraMarker.note ? `（${eraMarker.note}）` : ''}` : ''}
          </p>
        ) : null}

        {bio ? (
          <section className="codex-archive-sec">
            <h3 className="codex-sec">生平</h3>
            <div className="codex-archive-bio">
              <RichText text={linkify(bio, id)} onDrill={onDrill} />
            </div>
          </section>
        ) : null}

        <section className="codex-archive-sec">
          <h3 className="codex-sec">
            在位要事
            <em>{timeline.length} 条</em>
            {annotated ? <i>注解 {annotated}</i> : null}
          </h3>
          <EventTimeline
            details={timeline}
            openIds={openIds}
            onToggle={toggle}
            onDrill={onDrill}
          />
        </section>

        {prev || next ? (
          <section className="codex-archive-sec">
            <h3 className="codex-sec">{unit}</h3>
            <div className="codex-event-chips">
              {prev ? (
                <button type="button" className="codex-chip" onClick={() => onDrill(prev.id)}>
                  <em>上一位</em>
                  {prev.posthumousTitle}
                </button>
              ) : null}
              {next ? (
                <button type="button" className="codex-chip" onClick={() => onDrill(next.id)}>
                  <em>下一位</em>
                  {next.posthumousTitle}
                </button>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    )
  }

  /* ---------------- 诸侯 ---------------- */
  const lordRef = entry.kind === 'lord' ? getLordArchive(id) : null
  if (lordRef) {
    const { lord, siblings } = lordRef
    /* 诸侯事件直接来自 lord，不需要帝王索引；同样按名字给下钻入口 */
    const details: EventDetail[] = [...lord.events]
      .sort((a, b) => a.year - b.year)
      .map((event) => ({
        event,
        note: getEventNote(event.id),
        entry: entryForEventName(event.name),
        rulers: [],
        segment: null,
      }))
    const others = siblings.filter((item) => item.id !== lord.id).slice(0, 4)
    const annotated = details.filter((item) => item.note).length

    return (
      <div className="codex-archive">
        <div className="codex-archive-head">
          <span className="codex-archive-dynasty">
            {lord.state} · {lord.era}
          </span>
          <span className="codex-archive-reign">{lord.title}</span>
          <span className="codex-archive-reign">在位 {lord.reign}</span>
        </div>

        <p className="codex-archive-rule">
          <span>称霸</span>
          {formatYear(lord.hegemonyStart)} — {formatYear(lord.hegemonyEnd)}
          {lord.hegemonyNote ? ` · ${lord.hegemonyNote}` : ''}
        </p>

        {details.length ? (
          <section className="codex-archive-sec">
            <h3 className="codex-sec">
              重要事迹
              <em>{details.length} 条</em>
              {annotated ? <i>注解 {annotated}</i> : null}
            </h3>
            <EventTimeline
              details={details}
              openIds={openIds}
              onToggle={toggle}
              onDrill={onDrill}
            />
          </section>
        ) : null}

        {others.length ? (
          <section className="codex-archive-sec">
            <h3 className="codex-sec">同期诸侯</h3>
            <div className="codex-event-chips">
              {others.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="codex-chip"
                  onClick={() => onDrill(item.id)}
                >
                  <em>{item.state}</em>
                  {item.title}
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    )
  }

  return null
}
