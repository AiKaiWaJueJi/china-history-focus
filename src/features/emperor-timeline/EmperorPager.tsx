/**
 * EmperorPager —— 一页 3 个帝王模块的横向滑动分页
 * ===========================================================================
 * 用 AnimatePresence 的 popLayout 模式：新旧两页**重叠过渡**，
 * 新页滑入的同时旧页滑出，全程没有黑场（早先用 mode="wait" 会先清空再进场）。
 *
 * custom 传入方向，实现「下一页从右进、上一页从左进」的对称过渡。
 * 不足 3 个时补空槽位，保证卡片宽度始终一致（末页只有 1 位时不会突然变宽）。
 */
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { EmperorRecord } from '../../core/emperorTypes'
import { EmperorCard } from './EmperorCard'
import type { EmperorCardLayout } from './EmperorCard'

interface EmperorPagerProps {
  /** 当前页要显示的君主（分页由父级按分段切好，这里不再自己 slice） */
  pageEmperors: EmperorRecord[]
  pageIndex: number
  direction: number
  /** 一页的槽位数（用于补空槽，保证卡片宽度一致） */
  pageSize: number
  layout?: EmperorCardLayout
  compact?: boolean
}

const variants = {
  enter: (dir: number) => ({ x: dir >= 0 ? '38%' : '-38%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir >= 0 ? '-38%' : '38%', opacity: 0 }),
}

export function EmperorPager({
  pageEmperors,
  pageIndex,
  direction,
  pageSize,
  layout = 'split',
  compact = false,
}: EmperorPagerProps) {
  const prefersReducedMotion = useReducedMotion()
  const emptySlots = Math.max(0, pageSize - pageEmperors.length)

  return (
    <div className="pager">
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <motion.div
          key={pageIndex}
          className="pager-track"
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={
            prefersReducedMotion
              ? { duration: 0.12 }
              : { type: 'spring', stiffness: 320, damping: 34, mass: 0.85 }
          }
        >
          {pageEmperors.map((emperor, index) => (
            <EmperorCard
              key={emperor.id}
              emperor={emperor}
              index={index}
              layout={layout}
              compact={compact}
            />
          ))}
          {Array.from({ length: emptySlots }, (_, i) => (
            <div key={`empty-${i}`} className="emp-slot" aria-hidden="true" />
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
