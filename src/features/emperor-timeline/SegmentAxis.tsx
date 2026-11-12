/**
 * SegmentAxis —— 时代分段轴（时间轴上方的刻度带）
 * ===========================================================================
 * 需求：在帝王时间轴上方增加一条醒目的"时代分段轴"，
 *       按真实年份**比例**划分西周 / 东周，并在东周内用「垂直分割线 + 节点圆点」
 *       标出春秋、战国的起点。
 *
 * 为什么要按年份比例而不是等宽：
 *   西周 275 年、东周 514 年，若等宽会误导读者以为两个时代体量相当。
 *   按比例排布后，"东周占了三分之二"这件事一眼可见，本身就是一段历史信息。
 *
 * 交互：段带与标志点都可点击 —— 直接跳到该时期的第一位君主所在页。
 */
import type { CSSProperties } from 'react'
import type { EmperorRecord, TimelineSegment } from '../../core/emperorTypes'
import { formatYear } from '../../data/emperorData'

/** 播放头固定宽度（百分比）：约等于一页平均跨度的视觉宽度 */
const PLAYHEAD_WIDTH = 7.5

interface SegmentAxisProps {
  segments: TimelineSegment[]
  emperors: EmperorRecord[]
  pageIndex: number
  pageSize: number
  /** 点击某一年份 → 跳到对应页 */
  onJumpToYear: (year: number) => void
}

type BandStyle = CSSProperties & { '--accent': string }

export function SegmentAxis({ segments, emperors, pageIndex, pageSize, onJumpToYear }: SegmentAxisProps) {
  if (segments.length === 0) return null

  const domainStart = Math.min(...segments.map((s) => s.startYear))
  const domainEnd = Math.max(...segments.map((s) => s.endYear))
  const span = Math.max(domainEnd - domainStart, 1)

  /** 年份 → 百分比（左端＝最早年份） */
  const pos = (year: number) => ((year - domainStart) / span) * 100

  // 当前页覆盖的时间窗（用于"播放头"）
  const pageEmperors = emperors.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize)
  const pageStart = pageEmperors[0]?.startYear
  const pageEnd = pageEmperors[pageEmperors.length - 1]?.endYear ?? pageStart

  return (
    <div className="seg-axis" role="group" aria-label="时代分段">
      <div className="seg-track">
        {segments.map((segment) => {
          const left = pos(segment.startYear)
          const width = pos(segment.endYear) - left
          const style: BandStyle = {
            left: `${left}%`,
            width: `${width}%`,
            '--accent': segment.accent,
          }
          return (
            <button
              key={segment.id}
              type="button"
              className="seg-band"
              style={style}
              onClick={() => onJumpToYear(segment.startYear)}
              title={`${segment.name} ${formatYear(segment.startYear)}—${formatYear(segment.endYear)} · 点击跳转`}
            >
              <span className="seg-band-bar" />
              <span className="seg-band-label">
                <span className="seg-band-name">{segment.name}</span>
                <span className="seg-band-range">
                  {formatYear(segment.startYear)} — {formatYear(segment.endYear)}
                </span>
              </span>
            </button>
          )
        })}

        {/* 段内子时期标志点（春秋 / 战国） */}
        {segments.flatMap((segment) =>
          (segment.markers ?? []).map((marker) => (
            <button
              key={marker.id}
              type="button"
              className="seg-marker"
              style={{ left: `${pos(marker.year)}%` }}
              onClick={() => onJumpToYear(marker.year)}
              title={`${marker.name} 始于 ${formatYear(marker.year)}${marker.note ? ' · ' + marker.note : ''}`}
            >
              <span className="seg-marker-line" />
              <span className="seg-marker-dot" />
              <span className="seg-marker-label">
                {marker.name}
                <em>{formatYear(marker.year)}</em>
              </span>
            </button>
          )),
        )}

        {/*
          播放头：标记"当前页大致落在哪一段"。
          刻意用**固定宽度**（PLAYHEAD_WIDTH），只让位置随页移动。
          早先是按当前页的年份跨度算宽度，而每页跨越的年数不同（有的 30 年、
          有的 70 年），于是滚轮翻页时指示条一会宽一会细，视觉上很跳。
          现在宽度恒定，动的是位置 —— 这类"位置指示器"本该如此。
        */}
        {pageStart !== undefined ? (
          <div
            className="seg-playhead"
            style={{
              left: `${Math.min(Math.max(pos((pageStart + pageEnd) / 2) - PLAYHEAD_WIDTH / 2, 0), 100 - PLAYHEAD_WIDTH)}%`,
              width: `${PLAYHEAD_WIDTH}%`,
            }}
            aria-hidden="true"
          />
        ) : null}
      </div>
    </div>
  )
}
