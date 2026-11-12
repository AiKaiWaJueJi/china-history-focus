/**
 * BattlePanel —— 战报栏
 * ===========================================================================
 * 两种宽度：
 *   常态 22%  → 与地图并置，只做「时间线注脚」
 *   聚焦 50%  → 地图退为暗色背景（opacity .3 + grayscale），战报成为主角
 *
 * 字体按需求指定（含 fallback）：
 *   标题 '方正小标简宋', serif
 *   正文 '仿宋GB2312', 'FangSong', serif
 *
 * 战报里的重要人物（王翦、王贲…）会被替换成可点击标签，
 * 点击后打开人物 Modal（数据在 endgame.zhou.json 的 figures 里）。
 */
import type { EndgameEvent, EndgameFigure } from '../../core/emperorTypes'

interface BattlePanelProps {
  events: EndgameEvent[]
  index: number
  intro: string
  focusedEvent: EndgameEvent | null
  onFigureClick: (figureId: string) => void
}

/** 把正文中的人物名切成可点击标签 */
function renderReport(text: string, figures: EndgameFigure[], onFigureClick: (id: string) => void) {
  if (figures.length === 0) return text

  // 长名字优先匹配，避免"王翦"与"王贲"互相截断
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

export function BattlePanel({
  events,
  index,
  intro,
  focusedEvent,
  onFigureClick,
}: BattlePanelProps) {
  const visible = events.slice(0, index)

  return (
    <aside className={`battle-panel${focusedEvent ? ' is-focused' : ''}`} aria-live="polite">
      <header className="battle-head">
        <h2 className="battle-title">战报</h2>
        <span className="battle-count">
          {index === 0 ? '未启战端' : `已灭 ${index} / ${events.length}`}
        </span>
      </header>

      {index === 0 ? (
        <p className="battle-intro">{intro}</p>
      ) : (
        <ol className="battle-list">
          {visible.map((event) => {
            const isActive = focusedEvent?.id === event.id
            return (
              <li key={event.id} className={`battle-item${isActive ? ' is-active' : ''}`}>
                <span className="battle-year">{event.year}</span>
                <h3 className="battle-item-title">{event.desc}</h3>
                <p className="battle-text">
                  {renderReport(event.report, event.figures, onFigureClick)}
                </p>

                {isActive ? (
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
              </li>
            )
          })}
        </ol>
      )}

      {focusedEvent ? (
        <p className="battle-exit-hint">点击地图空白处或再次点击该国，退出聚焦</p>
      ) : (
        <p className="battle-exit-hint">点击地图上的国家，展开该国战报</p>
      )}
    </aside>
  )
}
