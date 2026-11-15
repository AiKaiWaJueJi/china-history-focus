/**
 * BattlePanel —— 灭国战报（仅在聚焦时展开）
 * ===========================================================================
 * 默认不渲染：地图独占整个宽度。
 * 点击某国后才从左侧展开，内容是该国**灭国前的详细情况**：
 *   战前形势 / 战役经过 / 结局 —— 三段式，而不是时间线上那一句话。
 *
 * 字体按需求指定（含 fallback）：
 *   标题 '方正小标简宋', serif
 *   正文 '仿宋GB2312', 'FangSong', serif
 */
import { Fragment, useEffect, useState } from 'react'
import type { EndgameEvent, EndgameFigure } from '../../core/emperorTypes'
import { SourceQuote } from './SourceQuote'

/** 把正文中的人物名切成可点击标签（长名字优先匹配，避免"王翦/王贲"互相截断） */
function renderWithFigures(
  text: string,
  figures: EndgameFigure[],
  onFigureClick: (id: string) => void,
) {
  if (figures.length === 0) return text
  const names = [...figures].map((figure) => figure.name).sort((a, b) => b.length - a.length)
  const pattern = new RegExp(`(${names.join('|')})`, 'g')

  return text.split(pattern).map((part, i) => {
    const figure = figures.find((item) => item.name === part)
    if (!figure) return <span key={i}>{part}</span>
  return (
      <button
        key={i}
        type="button"
        className="figure-tag"
        onClick={(event) => {
          event.stopPropagation()
          onFigureClick(figure.id)
        }}
        title={`查看 ${figure.name} 生平`}
      >
        {part}
      </button>
    )
  })
}

interface BattlePanelProps {
  event: EndgameEvent
  /** hover 某一段进军时，让地图重新点亮该路线 */
  onCampaignHover?: (phase: number | null) => void
  /** 正在播出场动画（父级 240ms 后才真正卸载） */
  closing?: boolean
  onFigureClick: (figureId: string) => void
  /** 打开当前这一页的史料档案（右侧抽屉） */
  onCodex?: () => void
  onClose: () => void
  /** 当前战报页变化（父级据此把地图年份切到该页，例如 581 页要显示「隋」） */
  onActiveChange?: (yearValue: number) => void
}

export function BattlePanel({ event, closing, onFigureClick, onCodex, onClose, onCampaignHover, onActiveChange }: BattlePanelProps) {
  const pages = event.battlePages?.length ? [event, ...event.battlePages] : [event]
  const [page, setPage] = useState(0)
  useEffect(() => setPage(0), [event.id])
  const active = pages[Math.min(page, pages.length - 1)]

  useEffect(() => {
    onActiveChange?.(pages[Math.min(page, pages.length - 1)].yearValue)
    // pages 每次渲染都会重建，只用 event.id + page 作为触发条件
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id, page, onActiveChange])

  return (
    <aside
      key={page}
      className={'battle-panel' + (closing ? ' is-closing' : '')}
      aria-label={active.desc + '详细战报'}
    >
      <header className="battle-head">
        <div>
          <span className="battle-year">{active.year}</span>
          <h2 className="battle-title">{active.desc}</h2>
        </div>
        <div className="battle-head-actions">
          {onCodex ? (
            <button type="button" className="battle-codex" onClick={onCodex} title="查看这一战的史料档案">
              史料
            </button>
          ) : null}
          <button type="button" className="battle-close" onClick={onClose} aria-label="关闭战报">
            ×
          </button>
        </div>
      </header>

      <div className="battle-section">
        <span className="battle-section-label">战前形势</span>
        <p className="battle-text">
          {renderWithFigures(active.detail.situation, active.figures, onFigureClick)}
        </p>
      </div>

      <div className="battle-section">
        <span className="battle-section-label">战役经过</span>
        <p className="battle-text">
          {renderWithFigures(active.detail.course, active.figures, onFigureClick)}
        </p>
      </div>

      <div className="battle-section">
        <span className="battle-section-label">结局</span>
        <p className="battle-text">
          {renderWithFigures(active.detail.result, active.figures, onFigureClick)}
        </p>
      </div>

      {/* 进军序列：hover 任一条，右侧地图会重新点亮对应路线（不带文字） */}
      {active.campaigns?.length ? (
        <div className="campaign-list">
          <span className="campaign-list-label">进军序列</span>
          {active.campaigns.map((campaign, i) => (
            <Fragment key={`${campaign.phase}-${i}`}>
              <button
                type="button"
                className={`campaign-item side-${campaign.side}`}
                onMouseEnter={() => onCampaignHover?.(i)}
                onMouseLeave={() => onCampaignHover?.(null)}
                onFocus={() => onCampaignHover?.(i)}
                onBlur={() => onCampaignHover?.(null)}
              >
                <span className="campaign-item-phase">{i + 1}</span>
                <span className="campaign-item-general">{campaign.general}</span>
                <span className="campaign-item-route">
                  {campaign.from} → {campaign.to}
                </span>
                <span className="campaign-item-result">{campaign.result}</span>
              </button>

              {(campaign.allies ?? []).map((ally) => (
                <div
                  key={`${campaign.phase}-${ally.nation}`}
                  className="campaign-ally-row"
                  onMouseEnter={() => onCampaignHover?.(i)}
                  onMouseLeave={() => onCampaignHover?.(null)}
                >
                  <span className="campaign-ally-tag">援军</span>
                  <span className="campaign-ally-text">
                    {ally.nation}·{ally.general} 率 {ally.troops}
                  </span>
                  <span className="campaign-ally-reason">{ally.reason}</span>
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      ) : null}

      {/* 史实注记：异说 / 避讳 / 图例范围，和叙事正文分开 */}
      {active.note ? (
        <div className="battle-section battle-note">
          <span className="battle-section-label">史实注记</span>
          <p className="battle-text">{active.note}</p>
        </div>
      ) : null}

      {/* 三段式正文之后：史料原文 */}
      {pages.length > 1 ? (
        <div className="battle-pager">
          {page > 0 ? (
            <button type="button" className="battle-page-btn" onClick={() => setPage((v) => v - 1)}>
              ← 返回上一战报
            </button>
          ) : null}
          {page < pages.length - 1 ? (
            <button
              type="button"
              className="battle-page-btn battle-page-btn--primary"
              onClick={() => setPage((v) => v + 1)}
            >
              下一战报 · 隋代周 →
            </button>
          ) : (
            <span className="battle-page-hint">已是最后一页</span>
          )}
        </div>
      ) : null}

      <SourceQuote
        bookName={active.sourceText.bookName}
        text={active.sourceText.text}
        translation={active.sourceText.translation}
      />

      {active.figures.length > 0 ? (
        <div className="battle-figures">
          <span className="battle-figures-label">相关人物</span>
          {active.figures.map((figure) => (
            <button
              key={figure.id}
              type="button"
              className="figure-card"
              onClick={() => onFigureClick(figure.id)}
            >
              <span className="figure-card-name">{figure.name}</span>
              <span className="figure-card-title">{figure.title}</span>
            </button>
          ))}
        </div>
      ) : null}

      <p className="battle-exit-hint">点击战报外任意处关闭</p>
    </aside>
  )
}
