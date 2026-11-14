/**
 * NanBeiTimeline —— 南北朝多行帝王时间轴
 * ===========================================================================
 * 南朝与北朝是并行的，不能用"一条时间轴翻页"来表达。
 * 这里按四行并行：
 *   北魏 / 东魏·北齐 / 西魏·北周 / 南朝（宋齐梁陈）
 * 横向以 420—589 年为单位铺开，帝王卡按在位年份定位；
 * 易代节点（479/502/534/550/557/577/589）是菱形，点开是全屏过渡页。
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import raw from '../../data/nanbei.json'
import './nanbei.css'

interface Row {
  id: string
  name: string
  note: string
}

interface Polity {
  id: string
  name: string
  row: string
  start: number
  end: number
  full: string
}

interface Emperor {
  id: string
  polity: string
  title: string
  name: string
  start: number
  end: number
}

interface NodeAct {
  heading: string
  lines: string[]
  source: { book: string; text: string }
}

interface TimelineNode {
  id: string
  year: number
  title: string
  subtitle: string
  acts: NodeAct[]
}

interface NanBeiData {
  id: string
  title: string
  period: string
  intro: string
  rows: Row[]
  polities: Polity[]
  emperors: Emperor[]
  nodes: TimelineNode[]
}

const DATA = raw as NanBeiData
const START = 420
const END = 589
const SCALE = 16
const LABEL = 96
const WIDTH = (END - START) * SCALE

const polityById = new Map(DATA.polities.map((p) => [p.id, p]))

function ticks() {
  const out: number[] = []
  for (let y = 420; y <= 580; y += 20) out.push(y)
  out.push(589)
  return out
}

/** 卡片窄，去掉朝代前缀，只留庙号/谥号；完整称号在 title 与详情里 */
function displayTitle(title: string) {
  return title.replace(/^(宋|南齐|齐|梁|陈|北魏|东魏|西魏|北齐|北周)/, '')
}

export function NanBeiTimeline() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState<Emperor | null>(null)
  const [nodeId, setNodeId] = useState<string | null>(null)
  const [actIndex, setActIndex] = useState(0)

  const node = DATA.nodes.find((n) => n.id === nodeId) ?? null

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (nodeId) setNodeId(null)
      else if (selected) setSelected(null)
      else navigate('/')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [nodeId, selected, navigate])

  const openNode = (id: string) => {
    setSelected(null)
    setNodeId(id)
    setActIndex(0)
  }

  return (
    <div className="nanbei">
      <header className="nbc-head">
        <button type="button" className="nbc-back" onClick={() => navigate('/')}>
          ← 返回朝代主页
        </button>
        <div className="nbc-title">
          <h1>{DATA.title}</h1>
          <span>{DATA.period}</span>
        </div>
        <p className="nbc-intro">{DATA.intro}</p>
      </header>

      <div className="nbc-legend">
        {DATA.rows.map((row) => (
          <span key={row.id} className={`nbc-legend-row nbc-row-${row.id}`}>
            <i />
            {row.name}
            <em>{row.note}</em>
          </span>
        ))}
        <span className="nbc-legend-node">
          <i className="nbc-diamond" />
          易代节点 · 点击查看过渡页
        </span>
        <span className="nbc-legend-note">短祚（1—2 年）以圆点表示，点开可看详情</span>
      </div>

      <p className="nbc-scroll-hint">横向滚动查看 420—589 全程 · 点击帝王看详情 · 点击菱形看过渡页</p>

      <div className="nbc-scroll">
        <div className="nbc-canvas" style={{ width: LABEL + WIDTH }}>
          <div className="nbc-axis" style={{ marginLeft: LABEL, width: WIDTH }}>
            {ticks().map((year) => (
              <span key={year} className="nbc-tick" style={{ left: (year - START) * SCALE }}>
                {year}
              </span>
            ))}
            {DATA.nodes.map((n) => (
              <button
                key={n.id}
                type="button"
                className="nbc-node"
                style={{ left: (n.year - START) * SCALE }}
                data-node={n.id}
                data-year={n.year}
                data-title={n.title}
                onClick={() => openNode(n.id)}
                title={`${n.year} · ${n.title}`}
              >
                <em>{n.year}</em>
                <i className="nbc-diamond" />
              </button>
            ))}
          </div>

          <div className="nbc-rows">
            {DATA.rows.map((row) => {
              const polities = DATA.polities.filter((p) => p.row === row.id)
              const emperors = DATA.emperors.filter((e) => polityById.get(e.polity)?.row === row.id)
              return (
                <div key={row.id} className={`nbc-row nbc-row-${row.id}`}>
                  <div className="nbc-rowlabel">
                    <b>{row.name}</b>
                    <em>{row.note}</em>
                  </div>
                  <div className="nbc-lane" style={{ width: WIDTH }}>
                    {polities[0] && polities[0].start > START ? (
                      <span
                        className="nbc-empty"
                        style={{
                          left: Math.max(8, ((polities[0].start - START) * SCALE) / 2 - 70),
                        }}
                      >
                        {polities[0].start} 年前属北魏
                      </span>
                    ) : null}
                    {polities.map((polity) => (
                      <div
                        key={polity.id}
                        className="nbc-polity"
                        data-polity={polity.id}
                        style={{
                          left: (polity.start - START) * SCALE,
                          width: (polity.end - polity.start) * SCALE,
                        }}
                      >
                        <span>
                          {polity.name}
                          <em>{polity.full}</em>
                        </span>
                      </div>
                    ))}
                    {emperors.map((emperor) => {
                      const short = emperor.end - emperor.start <= 2
                      const width = short ? 20 : Math.max((emperor.end - emperor.start) * SCALE, 54)
                      return (
                        <button
                          key={emperor.id}
                          type="button"
                          className={`nbc-emp${short ? ' is-short' : ''}`}
                          data-emp={emperor.id}
                          style={{ left: (emperor.start - START) * SCALE, width }}
                          onClick={() => setSelected(emperor)}
                          title={`${emperor.title} ${emperor.name}（${emperor.start}—${emperor.end}）`}
                        >
                          <b>{short ? displayTitle(emperor.title).slice(0, 1) : displayTitle(emperor.title)}</b>
                          <em>
                            {emperor.start}—{emperor.end}
                          </em>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {DATA.nodes.map((n) => (
            <div
              key={n.id}
              className="nbc-node-line"
              style={{ left: LABEL + (n.year - START) * SCALE }}
              aria-hidden
            />
          ))}
        </div>
      </div>

      {selected ? (
        <aside className="nbc-detail" data-emp-detail={selected.id}>
          <button type="button" className="nbc-detail-close" onClick={() => setSelected(null)}>
            ×
          </button>
          <span>{polityById.get(selected.polity)?.name}</span>
          <h2>{selected.title}</h2>
          <p>{selected.name}</p>
          <em>
            {selected.start} — {selected.end} 年在位
          </em>
          <small>点击其他帝王可切换；ESC 关闭</small>
        </aside>
      ) : null}

      {node ? (
        <div className="nbc-overlay" role="dialog" aria-modal="true" onClick={() => setNodeId(null)}>
          <div className="nbc-overlay-card" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="nbc-overlay-close" onClick={() => setNodeId(null)}>
              ×
            </button>
            <div className="nbc-overlay-head">
              <span>{node.year} 年</span>
              <h2>{node.title}</h2>
              <p>{node.subtitle}</p>
            </div>
            <div className="nbc-overlay-act">
              <div className="nbc-overlay-step">
                第 {actIndex + 1} / {node.acts.length} 幕
              </div>
              <h3>{node.acts[actIndex].heading}</h3>
              {node.acts[actIndex].lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
              <blockquote>
                <cite>{node.acts[actIndex].source.book}</cite>
                {node.acts[actIndex].source.text}
              </blockquote>
            </div>
            <div className="nbc-overlay-actions">
              <button type="button" onClick={() => setActIndex((i) => Math.max(0, i - 1))} disabled={actIndex === 0}>
                ← 上一幕
              </button>
              <div className="nbc-overlay-dots">
                {node.acts.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    className={i === actIndex ? 'is-active' : ''}
                    onClick={() => setActIndex(i)}
                    aria-label={`第 ${i + 1} 幕`}
                  />
                ))}
              </div>
              {actIndex < node.acts.length - 1 ? (
                <button type="button" className="nbc-primary" onClick={() => setActIndex((i) => i + 1)}>
                  下一幕 →
                </button>
              ) : (
                <button type="button" className="nbc-primary" onClick={() => setNodeId(null)}>
                  回到时间轴
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

