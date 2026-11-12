/**
 * EndgameStage —— 王朝覆灭（可逆战略沙盘）
 * ===========================================================================
 * 与上一版（自动播放动画）的根本区别：
 *   这里没有计时器、没有「开始」按钮。
 *   用户点击地图上的国家或底部节点 → setIndex(n) → 全部视图重算。
 *   因为所有派生数据都来自单个 index，"回退"不需要任何撤销代码。
 *
 * 组成：
 *   BattlePanel        战报（常态 22% → 聚焦 50%）
 *   WarringStatesMap   版图（墨色自西向东蔓延）
 *   StepRail           0..6 阶梯控制器
 *   FigureModal        人物生平
 *   QinSeal + 入口卡    index === 6 时的终局
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

/** 滚轮返回上一页的冷却，防止一次滚动连续跳转 */
const WHEEL_COOLDOWN = 900

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

  /* 总步数由数据注入，避免 store 里硬编码 6 */
  useEffect(() => {
    useEndgameStore.setState({ total: events.length })
  }, [events.length])

  /* 离开页面时复位，下次进入是干净的沙盘 */
  useEffect(() => () => resetAll(), [resetAll])

  /* 点击国家：推进/回退到该节点，并聚焦该国战报 */
  const handleConquer = useCallback(
    (event: (typeof events)[number]) => {
      conquerTo(event.order, event.nationId)
      if (!muted) playDrum(0.8, (event.order - 1) * 2)
    },
    [conquerTo, muted],
  )

  /* 点击底部节点 */
  const handleStep = useCallback(
    (value: number) => {
      setIndex(value)
      useEndgameStore.setState({ focusedNation: null })
      if (value === events.length && events.length > 0 && !muted) playGong(0.6)
      else if (value > 0 && !muted) playDrum(0.6, (value - 1) * 2)
    },
    [setIndex, events.length, muted],
  )

  /* 滚轮向上 → 回到时间轴最后一页（带冷却） */
  useEffect(() => {
    if (!dynastyId) return
    let lastAt = 0
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY > -24) return
      const now = Date.now()
      if (now - lastAt < WHEEL_COOLDOWN) return
      lastAt = now
      navigate(`/dynasty/${dynastyId}`, { state: { page: 'last' } })
    }
    window.addEventListener('wheel', onWheel, { passive: true })
    return () => window.removeEventListener('wheel', onWheel)
  }, [dynastyId, navigate])

  /* 键盘：ESC 逐层退出（人物 → 聚焦 → 返回时间轴） */
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
      else if (focusedNation) useEndgameStore.setState({ focusedNation: null })
      else if (dynastyId) navigate(`/dynasty/${dynastyId}`)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [index, setIndex, profileId, focusedNation, openProfile, dynastyId, navigate])

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
          <span className="endgame-step-hint">滚轮上滑 / ESC 返回 · ← → 逐级推移</span>
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
        <BattlePanel
          events={events}
          index={index}
          intro={endgame.intro}
          focusedEvent={focusedEvent}
          onFigureClick={openProfile}
        />

        <WarringStatesMap
          events={events}
          index={index}
          dimmed={Boolean(focusedEvent)}
          onConquer={handleConquer}
          onExitFocus={() => useEndgameStore.setState({ focusedNation: null })}
          overlay={
            isFinished ? (
              <>
                {/* 六国尽墨：秦印落下 + 进入秦朝 */}
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
