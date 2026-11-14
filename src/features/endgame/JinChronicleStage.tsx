/**
 * JinChronicleStage —— 晋末「十六国 · 南北分合」势力沙盘
 * ===========================================================================
 * 与战国/楚汉/三国的"灭国战"不同，316—420 的北方不是一国吞并另一国，
 * 而是多个政权在同一片区域上反复更替。因此这里不做"攻方/守方"，
 * 只做**逐年势力快照**：每一步给出十三块区域的归属，换色即换主。
 *
 * 史料口径：
 *   · 区域是示意分区，不是精确疆界；重点是"谁在何时据有哪一方"。
 *   · 河西诸凉、河南拉锯等无法在单块区域里表达的部分，写在 note 里。
 *   · 每一步都带《晋书》/《宋书》/《魏书》出处，避免"看着像"就写。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import chronicle from '../../data/jin.chronicle.json'
import './jin-chronicle.css'

interface ChronicleRegion {
  id: string
  name: string
  label: number[]
  points: string
}

interface ChronicleRegime {
  id: string
  name: string
  color: string
}

interface ChronicleStep {
  id: string
  year: string
  yearValue: number
  title: string
  summary: string
  source: { bookName: string; text: string }
  note?: string
  control: Record<string, string>
}

interface ChronicleData {
  dynastyId: string
  title: string
  subtitle: string
  intro: string
  pre: ChronicleStep
  steps: ChronicleStep[]
  regions: ChronicleRegion[]
  regimes: ChronicleRegime[]
}

const DATA = chronicle as ChronicleData
const STEPS: ChronicleStep[] = [DATA.pre, ...DATA.steps]

const REGIME_BY_ID = new Map(DATA.regimes.map((r) => [r.id, r]))

function shortTitle(title: string) {
  return title.length > 6 ? `${title.slice(0, 6)}…` : title
}

export function JinChronicleStage() {
  const navigate = useNavigate()
  const [index, setIndex] = useState(0)
  const lastWheel = useRef(0)
  const step = STEPS[index]

  const go = useCallback((dir: 1 | -1) => {
    setIndex((i) => Math.min(STEPS.length - 1, Math.max(0, i + dir)))
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault()
        go(1)
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault()
        go(-1)
      } else if (event.key === 'Escape') {
        navigate('/dynasty/jin')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, navigate])

  const onWheel = (event: React.WheelEvent) => {
    if (!event.deltaY) return
    const now = performance.now()
    if (now - lastWheel.current < 420) return
    lastWheel.current = now
    go(event.deltaY > 0 ? 1 : -1)
  }

  const activeRegimes = useMemo(() => {
    const counts = new Map<string, number>()
    for (const region of DATA.regions) {
      const regimeId = step.control[region.id]
      counts.set(regimeId, (counts.get(regimeId) ?? 0) + 1)
    }
    return DATA.regimes
      .filter((r) => counts.has(r.id))
      .map((r) => ({ ...r, count: counts.get(r.id) ?? 0 }))
      .sort((a, b) => b.count - a.count)
  }, [step])

  const last = index === STEPS.length - 1

  return (
    <div className="jin-chronicle" onWheel={onWheel}>
      <header className="jc-head">
        <button type="button" className="jc-back" onClick={() => navigate('/dynasty/jin')}>
          ↑ 返回晋时间轴
        </button>
        <div className="jc-title">
          <h1>{DATA.title}</h1>
          <span>{DATA.subtitle}</span>
        </div>
        <p className="jc-hint">滚轮 / ← → 逐步推演 · 共 {STEPS.length} 幕 · ESC 返回</p>
      </header>

      <div className="jc-body">
        <div className="jc-map">
          <svg viewBox="0 0 1000 640" role="img" aria-label="316—420 年北方十六国与南方东晋、刘宋势力示意图">
            <defs>
              <filter id="jc-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="6" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <polygon
              className="jc-land"
              points="60,160 200,130 330,70 480,60 620,80 760,150 900,100 980,220 970,430 930,540 900,630 700,620 400,590 180,520 60,360"
            />
            {DATA.regions.map((region) => {
              const regime = REGIME_BY_ID.get(step.control[region.id])
              const [lx, ly] = region.label
              return (
                <g key={region.id} className="jc-region" data-region={region.id} data-regime={regime?.id}>
                  <polygon
                    points={region.points}
                    fill={regime?.color ?? '#444'}
                    fillOpacity={0.58}
                    stroke="rgba(8, 10, 12, 0.9)"
                    strokeWidth={2}
                  />
                  <polygon
                    points={region.points}
                    fill="none"
                    stroke={regime?.color ?? '#444'}
                    strokeOpacity={0.9}
                    strokeWidth={1.2}
                  />
                  <title>
                    {region.name} · {regime?.name}
                  </title>
                  <text x={lx} y={ly} className="jc-region-name">
                    {region.name}
                  </text>
                  <text x={lx} y={ly + 26} className="jc-regime-name" fill={regime?.color ?? '#aaa'}>
                    {regime?.name}
                  </text>
                </g>
              )
            })}
          </svg>
          <div className="jc-legend">
            {activeRegimes.map((regime) => (
              <span key={regime.id} className="jc-chip" data-regime-chip={regime.id}>
                <i style={{ background: regime.color }} />
                {regime.name}
                <em>{regime.count}</em>
              </span>
            ))}
          </div>
          <p className="jc-mapnote">区域为示意分区，以归属为主，不描精确边界；河西诸凉、河南拉锯见右侧注记。</p>
        </div>

        <aside className="jc-panel">
          <div className="jc-stepno">
            第 {index + 1} / {STEPS.length} 幕
            <span>{step.year}</span>
          </div>
          <h2>{step.title}</h2>
          <p className="jc-summary">{step.summary}</p>
          <blockquote className="jc-source">
            <cite>{step.source.bookName}</cite>
            <span>{step.source.text}</span>
          </blockquote>
          {step.note ? <p className="jc-note">注：{step.note}</p> : null}
          <p className="jc-intro">{index === 0 ? DATA.intro : ''}</p>

          <div className="jc-actions">
            <button type="button" onClick={() => go(-1)} disabled={index === 0}>
              ← 上一幕
            </button>
            {last ? (
              <button type="button" className="jc-primary" onClick={() => navigate('/')}>
                推演结束 · 入宋
              </button>
            ) : (
              <button type="button" className="jc-primary" onClick={() => go(1)}>
                下一幕 →
              </button>
            )}
          </div>
        </aside>
      </div>

      <nav className="jc-rail" aria-label="推演步骤">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            data-step={i}
            className={`jc-node${i === index ? ' is-active' : ''}${i < index ? ' is-past' : ''}`}
            onClick={() => setIndex(i)}
            title={s.title}
          >
            <span>{s.year}</span>
            <em>{i === 0 ? '西晋亡' : shortTitle(s.title)}</em>
          </button>
        ))}
      </nav>
    </div>
  )
}
