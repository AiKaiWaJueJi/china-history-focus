/**
 * FigureModal —— 人物生平浮层
 * ===========================================================================
 * 全局唯一的 Modal：点击战报中的人物标签或人物卡打开，点击浮层外部关闭。
 * 同时支持 ESC 关闭（由父级统一处理键盘，避免多处监听打架）。
 */
import { useEffect } from 'react'
import type { EndgameFigure } from '../../core/emperorTypes'

interface FigureModalProps {
  figure: EndgameFigure | null
  onClose: () => void
}

export function FigureModal({ figure, onClose }: FigureModalProps) {
  // 打开时锁定背景滚动，避免滚轮误触底下的页面
  useEffect(() => {
    if (!figure) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [figure])

  if (!figure) return null

  return (
    <div className="figure-modal" onClick={onClose} role="dialog" aria-modal="true">
      <div className="figure-modal-card" onClick={(event) => event.stopPropagation()}>
        <header className="figure-modal-head">
          <div>
            <h2 className="figure-modal-name">{figure.name}</h2>
            <p className="figure-modal-title">{figure.title}</p>
          </div>
          <button type="button" className="figure-modal-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>

        <p className="figure-modal-bio">{figure.bio}</p>

        <div className="figure-modal-deeds">
          <span className="figure-modal-deeds-label">主要事迹</span>
          <ul>
            {figure.deeds.map((deed) => (
              <li key={deed}>{deed}</li>
            ))}
          </ul>
        </div>

        <p className="figure-modal-hint">点击浮层外部关闭</p>
      </div>
    </div>
  )
}
