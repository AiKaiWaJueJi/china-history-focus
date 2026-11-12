/**
 * EndgameStage —— 终局推演页（周朝收尾 → 秦朝入口）
 * ===========================================================================
 * 三个阶段（状态在 useEndgameStore 里）：
 *   idle     序章 + 「开启统一进程」
 *   playing  6 国依次灰化，版图逐步淬金，战报逐条浮现，每步配一声战鼓
 *   sealed   秦印砸下、钟鸣，版图容器变为【大秦帝国】入口卡片
 *
 * 页面是独立路由 /dynasty/:dynastyId/endgame：
 *   · 可被直接访问（分享链接、刷新都成立）
 *   · 浏览器后退键天然可用
 *   · 不污染时间轴的分页逻辑
 */
import { useCallback, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { dynastyById } from '../../data'
import { getDynastyEndgame } from '../../data/emperorData'
import { playGong, warmUpAudio } from './audio'
import { QinSeal } from './QinSeal'
import { StateTile } from './StateTile'
import { TerritoryMeter } from './TerritoryMeter'
import { useEndgameStore } from './useEndgameStore'
import { useEndgamePlayback } from './useEndgamePlayback'
import './endgame.css'

export function EndgameStage() {
  const { dynastyId } = useParams<{ dynastyId: string }>()
  const navigate = useNavigate()

  const dynasty = dynastyId ? dynastyById.get(dynastyId) : undefined
  const endgame = getDynastyEndgame(dynastyId)

  const phase = useEndgameStore((s) => s.phase)
  const fallen = useEndgameStore((s) => s.fallen)
  const muted = useEndgameStore((s) => s.muted)
  const begin = useEndgameStore((s) => s.begin)
  const reset = useEndgameStore((s) => s.reset)
  const toggleMute = useEndgameStore((s) => s.toggleMute)

  const events = endgame?.events ?? []
  useEndgamePlayback(events)

  // 离开页面时复位，避免下次进入看到"已经打完"的残局
  useEffect(() => () => reset(), [reset])

  const handleStart = useCallback(() => {
    warmUpAudio() // 必须在用户手势里初始化 AudioContext
    begin(events.length)
  }, [begin, events.length])

  const enterNext = useCallback(() => {
    if (!endgame) return
    if (!muted) playGong(0.6)
    navigate(`/dynasty/${endgame.next.dynastyId}`)
  }, [endgame, muted, navigate])

  if (!dynasty || !endgame) {
    return (
      <div className="endgame-page endgame-page--empty">
        <p className="endgame-empty-text">该朝代没有终局推演数据</p>
        <button type="button" className="endgame-btn" onClick={() => navigate('/')}>
          ← 返回朝代主页
        </button>
      </div>
    )
  }

  return (
    <div className="endgame-page" data-phase={phase}>
      {/* 肃杀感：整页压暗的径向暗角，纯 opacity 过渡 */}
      <div className="endgame-vignette" aria-hidden="true" />

      <header className="endgame-head">
        <div className="endgame-head-left">
          <button
            type="button"
            className="endgame-btn"
            onClick={() => navigate(`/dynasty/${dynasty.id}`)}
          >
            ← 返回时间轴
          </button>
          <h1 className="endgame-title" style={{ color: dynasty.accentSoft }}>
            {endgame.title}
          </h1>
          <span className="endgame-sub">{endgame.subtitle}</span>
        </div>
        <button
          type="button"
          className={`endgame-mute${muted ? ' is-muted' : ''}`}
          onClick={toggleMute}
          aria-label={muted ? '开启音效' : '关闭音效'}
        >
          {muted ? '🔇' : '🔔'}
        </button>
      </header>

      <div className="endgame-body">
        {/* 左：战报 */}
        <aside className="battle-log" aria-live="polite">
          <p className="battle-log-head">战报</p>
          {fallen === 0 ? (
            <p className="battle-log-intro">{endgame.intro}</p>
          ) : (
            <ol className="battle-log-list">
              {events.slice(0, fallen).map((event, i) => (
                <li
                  key={event.id}
                  className={`battle-log-item${i === fallen - 1 ? ' is-latest' : ''}`}
                >
                  <span className="battle-log-year">{event.year}</span>
                  <span className="battle-log-text">{event.report}</span>
                </li>
              ))}
            </ol>
          )}
        </aside>

        {/* 右：诸侯容器 + 版图 + 操作 */}
        <main className="endgame-stage">
          <div className="state-row">
            {events.map((event, index) => (
              <StateTile
                key={event.id}
                event={event}
                index={index}
                fallen={index < fallen}
                isLatest={index === fallen - 1}
              />
            ))}
          </div>

          <TerritoryMeter events={events} fallen={fallen} />

          <div className="endgame-actions">
            {phase === 'idle' ? (
              <button type="button" className="start-btn" onClick={handleStart}>
                <span className="start-btn-main">开启统一进程</span>
                <span className="start-btn-sub">六国次第入秦图 · 约 8 秒</span>
              </button>
            ) : null}

            {phase === 'playing' ? (
              <div className="playing-hint">
                <span className="playing-dot" aria-hidden="true" />
                推演中 · 已灭 {fallen} / {events.length}
              </div>
            ) : null}

            {phase === 'sealed' ? (
              <>
                <QinSeal />
                <button type="button" className="qin-entry" onClick={enterNext}>
                  <span className="qin-entry-year">{endgame.next.year}</span>
                  <span className="qin-entry-label">{endgame.next.label}</span>
                  <span className="qin-entry-hint">{endgame.next.hint} · 点击进入 →</span>
                </button>
              </>
            ) : null}
          </div>
        </main>
      </div>

      {/* 推演完成后允许重看 */}
      {phase === 'sealed' ? (
        <button type="button" className="endgame-replay" onClick={handleStart}>
          ↺ 重新推演
        </button>
      ) : null}
    </div>
  )
}
