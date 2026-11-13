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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { dynastyById } from '../../data'
import { getDynastyEndgame } from '../../data/emperorData'
import { playBell, warmUpAudio } from './audio'
import { BattlePanel } from './BattlePanel'
import { FigureModal } from './FigureModal'
import { StepRail } from './StepRail'
import { WarringStatesMap } from './WarringStatesMap'
import { useEndgameStore } from './useEndgameStore'
import { useCampaignPlayer, useCampaignStore } from './useCampaignPlayer'
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
  const resetAll = useEndgameStore((s) => s.resetAll)
  const openProfile = useEndgameStore((s) => s.openProfile)
  const toggleMute = useEndgameStore((s) => s.toggleMute)

  /* ---------------- 战役序列（行军路线） ---------------- */
  const campaignNation = useCampaignStore((s) => s.campaignNation)
  const campaignIndex = useCampaignStore((s) => s.campaignIndex)
  const campaignDone = useCampaignStore((s) => s.campaignDone)
  const hoveredCampaign = useCampaignStore((s) => s.hoveredCampaign)

  const activeCampaigns = useMemo(
    () => events.find((event) => event.nationId === campaignNation)?.campaigns ?? [],
    [events, campaignNation],
  )

  /*
    地图上要画哪一组路线：
    · 点击国家后走动画 → 用当前国家的序列，按播放进度
    · 直接看战报（点底部节点/回退）→ 用该事件自己的序列，全部视为已完成
  */
  const focusedCampaigns = events.find((e) => e.nationId === focusedNation)?.campaigns ?? []
  const mapCampaigns = campaignNation ? activeCampaigns : focusedCampaigns
  const mapDone = campaignNation ? campaignDone : focusedCampaigns.length > 0
  const mapIndex = campaignNation ? campaignIndex : focusedCampaigns.length - 1

  /*
    最后一段（秦军定局）生长时，敌国版图同步被"墨"吞掉：
    颜色变化与行军到达同时发生，而不是点击即变色。
  */
  const isLastPhase =
    Boolean(campaignNation) && campaignIndex === activeCampaigns.length - 1 && !campaignDone
  const annexingNation = isLastPhase ? campaignNation : null

  /* 播放完毕 → 打开战报（与动画进度严格对应：动画没走完不弹面板） */
  /** 双击跳过剩余动画，直接进战报 */
  const skipCampaign = useCallback(() => {
    if (!useCampaignStore.getState().campaignNation) return
    useCampaignStore.getState().finishCampaign()
  }, [])

  /*
    序列播完才吞并版图：index 在这一刻推进，敌国的墨色晕染与行军到达同步。
    之前是点击即 setIndex，版图瞬间变色，与动画脱节。
  */
  const openReportAfterCampaign = useCallback(() => {
    const nation = useCampaignStore.getState().campaignNation
    if (!nation) return
    const ev = events.find((e) => e.nationId === nation)
    if (ev) setIndex(ev.order)
    useEndgameStore.setState({ focusedNation: nation })
  }, [events, setIndex])

  useCampaignPlayer(activeCampaigns, openReportAfterCampaign)

  const focusedEvent = events.find((event) => event.nationId === focusedNation) ?? null
  const profile =
    profileId === null
      ? null
      : (events.flatMap((event) => event.figures).find((figure) => figure.id === profileId) ?? null)

  const isFinished = index === events.length && events.length > 0
  /* 终章要等战报关闭后再播：点「齐」先看战报，退出后才演一统 */
  const showFinale = isFinished && !focusedEvent

  /*
    关闭战报不能直接卸载：那样面板会"啪"地消失。
    这里先挂上 is-closing 让它播 240ms 退场动画，再真正清空 focusedNation。
  */
  const [closing, setClosing] = useState(false)
  const closeTimer = useRef<number | null>(null)

  const closePanel = useCallback(() => {
    if (!useEndgameStore.getState().focusedNation) return
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
    setClosing(true)
    closeTimer.current = window.setTimeout(() => {
      useEndgameStore.setState({ focusedNation: null })
      setClosing(false)
      closeTimer.current = null
    }, 240)
  }, [])

  useEffect(
    () => () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current)
    },
    [],
  )

  useEffect(() => {
    useEndgameStore.setState({ total: events.length })
  }, [events.length])

  /* 离开页面时复位 */
  useEffect(() => () => resetAll(), [resetAll])

  /* 点击国家：推进/回退到该节点，并展开该国详细战报 */
  const handleConquer = useCallback(
    (event: (typeof events)[number]) => {
      if (closeTimer.current) {
        window.clearTimeout(closeTimer.current)
        closeTimer.current = null
      }
      /*
        点国家 = 先推出已有战报 → 播战役序列 → 播完再弹新战报。
        index 不在这里推进：吞并在序列播完时才发生（见 openReportAfterCampaign），
        否则点一下版图就瞬间变色，与行军动画脱节。
      */
      if (useEndgameStore.getState().focusedNation) {
        useEndgameStore.setState({ focusedNation: null })
      }
      setClosing(false)
      warmUpAudio()
      const campaign = useCampaignStore.getState()
      campaign.clearCampaign()
      campaign.startCampaign(event.nationId)
      if (!muted) playBell(0.9)
    },
    [muted],
  )

  /*
    点「秦」= 回到战前。
    若战报正开着，先让它播完 240ms 退场动画再归零，避免面板"啪"地消失。
  */
  const handleReset = useCallback(() => {
    useCampaignStore.getState().clearCampaign()
    if (useEndgameStore.getState().focusedNation) {
      closePanel()
      window.setTimeout(() => useEndgameStore.getState().resetAll(), 240)
    } else {
      useEndgameStore.getState().resetAll()
    }
    if (!muted) playBell(0.7)
  }, [closePanel, muted])

  const handleStep = useCallback(
    (value: number) => {
      setIndex(value)
      closePanel()
      if (value > 0 && !muted) playBell(value === events.length ? 1 : 0.7)
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
            closing={closing}
            onFigureClick={openProfile}
            onClose={closePanel}
            onCampaignHover={(phase) => useCampaignStore.getState().setHoveredCampaign(phase)}
          />
        ) : null}

        <WarringStatesMap
          events={events}
          index={index}
          campaigns={mapCampaigns}
          campaignIndex={mapIndex}
          campaignDone={mapDone}
          hoveredCampaign={hoveredCampaign}
          onSkipCampaign={skipCampaign}
          annexingNation={annexingNation}
          dimmed={Boolean(focusedEvent)}
          unified={showFinale}
          onConquer={handleConquer}
          onExitFocus={closePanel}
          onReset={handleReset}
          overlay={
            /*
              整个终章（秦字 + 大秦帝国入口）都只在 showFinale 时挂载：
              之前入口卡片跟着 isFinished 渲染，导致"战报还开着、入口已经出现"。
            */
            showFinale ? (
              <>
                {/* 一统主角：七国版图消散后，秦字独立占据版图中心 */}
                <div className="unify-hero" aria-hidden="true">
                  {/*
                    缩放交给 .unify-core 统一做：
                    秦字与圆环是同一个盒子的两个子元素，天然同步、天然同心。
                    之前两者各自动画，才会出现"不同步"和"不居中"。
                  */}
                  <div className="unify-core">
                    <span className="unify-ring" />
                    <span className="unify-char">秦</span>
                  </div>
                </div>

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
