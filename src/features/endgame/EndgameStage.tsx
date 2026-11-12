/**
 * EndgameStage —— 王朝覆灭（可逆战略沙盘）
 * ===========================================================================
 * 交互模型（本轮重构成"用户掌控 + 分层浮现"）：
 *   默认      只有地图 + 底部阶梯，没有常驻战报栏
 *   悬浮国家  轻量卡片（年份 / 灭国 / 2-3 条要点），底部对应节点亮起流光
 *   点击国家  左侧展开详细战报（战前形势 / 经过 / 结局），地图变暗
 *   点击外部  关闭战报，地图恢复
 *
 * 状态仍然收敛在 useEndgameStore 的 index(0..6)：正向与回退共用同一套过渡。
 * 注意：本页**监听不到滚轮返回**——按需求改为「返回时间轴」按钮。
 */
import { useCallback, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { dynastyById } from '../../data'
import { getDynastyEndgame } from '../../data/emperorData'
import { playDrum, playGong } from './audio'
import { BattlePanel } from './BattlePanel'
import { FigureModal } from './FigureModal'
import { QinSeal } from './QinSeal'
import { StepRail } from './StepRail'
import { WarringStatesMap } from './WarringStatesMap'
import { useEndgameStore } from './useEndgameStore'
import './endgame.css'

export function EndgameStage() {
  const { dynastyId } = useParams<{ dynastyId: string }>()
  const navigate = useNavigate()

  const dynasty = dynastyId ? dynastyById.get(dynastyId) : undefined
  const endgame = getDynastyEndgame(dynastyId)
  const events = useMemo(() => endgame?.events ?? [], [endgame])

  const index = useEndgameStore((s) => s.index)
  const focusedNation = useEndgameStore((s) => s.focusedNation)
  const profileId = useEndgameStore((s) => s.profileId)
  const muted = useEndgameStore((s) => s.muted)
  const setIndex = useEndgameStore((s) => s.setIndex)
  const conquerTo = useEndgameStore((s) => s.conquerTo)
  const resetAll = useEndgameStore((s) => s.resetAll)
  const openProfile = useEndgameStore((s) => s.openProfile)
  const toggleMute = useEndgameStore((s) => s.toggleMute)

  const focusedEvent = events.find((event) => event.nationId === focusedNation) ?? null
  const profile =
    profileId === null
      ? null
      : (events.flatMap((event) => event.figures).find((figure) => figure.id === profileId) ?? null)

  const isFinished = index === events.length && events.length > 0

  const closePanel = useCallback(() => {
    useEndgameStore.setState({ focusedNation: null })
  }, [])

  useEffect(() => {
    useEndgameStore.setState({ total: events.length })
  }, [events.length])

  /* 离开页面时复位 */
  useEffect(() => () => resetAll(), [resetAll])

  /* 点击国家：推进/回退到该节点，并展开该国详细战报 */
  const handleConquer = useCallback(
    (event: (typeof events)[number]) => {
      conquerTo(event.order, event.nationId)
      if (!muted) playDrum(0.8, (event.order - 1) * 2)
    },
    [conquerTo, muted],
  )

  const handleStep = useCallback(
    (value: number) => {
      setIndex(value)
      closePanel()
      if (value === events.length && events.length > 0 && !muted) playGong(0.6)
      else if (value > 0 && !muted) playDrum(0.6, (value - 1) * 2)
    },
    [setIndex, closePanel, events.length, muted],
  )

  /* 键盘：ESC 逐层退出；← → 逐级推移 */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        setIndex(index + 1)
        return
      }
      if (event.key === 'ArrowLeft') {
        setIndex(index - 1)
        return
      }
      if (event.key !== 'Escape') return
      event.preventDefault()
      if (profileId) openProfile(null)
      else if (focusedNation) closePanel()
      else if (dynastyId) navigate(`/dynasty/${dynastyId}`)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [index, setIndex, profileId, focusedNation, openProfile, closePanel, dynastyId, navigate])

  if (!dynasty || !endgame) {
    return (
      <div className="endgame-page endgame-page--empty">
        <p className="endgame-empty-text">该朝代没有「王朝覆灭」数据</p>
        <button type="button" className="endgame-btn" onClick={() => navigate('/')}>
          ← 返回朝代主页
        </button>
      </div>
    )
  }

  return (
    <div className="endgame-page" data-index={index}>
      <div className="endgame-vignette" aria-hidden="true" />

      <header className="endgame-head">
        <div className="endgame-head-left">
          <button
            type="button"
            className="endgame-btn"
            onClick={() => navigate(`/dynasty/${dynasty.id}`, { state: { page: 'last' } })}
          >
            ← 返回时间轴
          </button>
          <h1 className="endgame-title" style={{ color: dynasty.accentSoft }}>
            {endgame.title}
          </h1>
          <span className="endgame-sub">{endgame.subtitle}</span>
        </div>

        <div className="endgame-head-right">
          <span className="endgame-step-hint">悬停看要点 · 点击看详情 · ← → 逐级推移</span>
          <button
            type="button"
            className={`endgame-mute${muted ? ' is-muted' : ''}`}
            onClick={toggleMute}
            aria-label={muted ? '开启音效' : '关闭音效'}
          >
            {muted ? '🔇' : '🔔'}
          </button>
        </div>
      </header>

      <div className={`endgame-body${focusedEvent ? ' is-focused' : ''}`}>
        {focusedEvent ? (
          <BattlePanel
            event={focusedEvent}
            onFigureClick={openProfile}
            onClose={closePanel}
          />
        ) : null}

        <WarringStatesMap
          events={events}
          index={index}
          dimmed={Boolean(focusedEvent)}
          onConquer={handleConquer}
          onExitFocus={closePanel}
          overlay={
            isFinished ? (
              <>
                <QinSeal />
                <button
                  type="button"
                  className="qin-entry"
                  onClick={() => navigate(`/dynasty/${endgame.next.dynastyId}`)}
                >
                  <span className="qin-entry-year">{endgame.next.year}</span>
                  <span className="qin-entry-label">{endgame.next.label}</span>
                  <span className="qin-entry-hint">{endgame.next.hint} · 点击进入 →</span>
                </button>
              </>
            ) : null
          }
        />
      </div>

      <StepRail events={events} index={index} onSelect={handleStep} />

      <FigureModal figure={profile} onClose={() => openProfile(null)} />
    </div>
  )
}
