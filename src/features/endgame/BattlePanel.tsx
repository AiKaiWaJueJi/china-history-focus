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
import type { EndgameEvent, EndgameFigure } from '../../core/emperorTypes'

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
  /** 正在播出场动画（父级 240ms 后才真正卸载） */
  closing?: boolean
  onFigureClick: (figureId: string) => void
  onClose: () => void
}

export function BattlePanel({ event, closing, onFigureClick, onClose }: BattlePanelProps) {
  return (
    <aside
      className={'battle-panel' + (closing ? ' is-closing' : '')}
      aria-label={event.desc + '详细战报'}
    >
      <header className="battle-head">
        <div>
          <span className="battle-year">{event.year}</span>
          <h2 className="battle-title">{event.desc}</h2>
        </div>
        <button type="button" className="battle-close" onClick={onClose} aria-label="关闭战报">
          ×
        </button>
      </header>

      <div className="battle-section">
        <span className="battle-section-label">战前形势</span>
        <p className="battle-text">
          {renderWithFigures(event.detail.situation, event.figures, onFigureClick)}
        </p>
      </div>

      <div className="battle-section">
        <span className="battle-section-label">战役经过</span>
        <p className="battle-text">
          {renderWithFigures(event.detail.course, event.figures, onFigureClick)}
        </p>
      </div>

      <div className="battle-section">
        <span className="battle-section-label">结局</span>
        <p className="battle-text">
          {renderWithFigures(event.detail.result, event.figures, onFigureClick)}
        </p>
      </div>

      {event.figures.length > 0 ? (
        <div className="battle-figures">
          <span className="battle-figures-label">相关人物</span>
          {event.figures.map((figure) => (
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
