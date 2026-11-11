/**
 * EmperorPager —— 一页 3 个帝王模块的横向滑动分页
 * ===========================================================================
 * 用 Framer Motion 的 AnimatePresence + mode="wait"：
 *   · 旧页先滑出，新页再滑入，避免两页同时占位导致宽度跳动；
 *   · custom 传入方向，实现「下一页从右进、上一页从左进」的对称过渡。
 *
 * 不足 3 个时补空槽位，保证卡片宽度始终一致（末页只有 1 位时不会突然变宽）。
 */
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { EmperorRecord } from '../../core/emperorTypes'
import { EmperorCard } from './EmperorCard'

interface EmperorPagerProps {
  emperors: EmperorRecord[]
  pageIndex: number
  direction: number
  pageSize: number
}

const variants = {
  enter: (dir: number) => ({ x: dir >= 0 ? '52%' : '-52%', opacity: 0, scale: 0.98 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (dir: number) => ({ x: dir >= 0 ? '-52%' : '52%', opacity: 0, scale: 0.98 }),
}

export function EmperorPager({ emperors, pageIndex, direction, pageSize }: EmperorPagerProps) {
  const prefersReducedMotion = useReducedMotion()
  const start = pageIndex * pageSize
  const pageEmperors = emperors.slice(start, start + pageSize)
  const emptySlots = Math.max(0, pageSize - pageEmperors.length)

  return (
    <div className="pager">
      <AnimatePresence mode="wait" initial={false} custom={direction}>
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
              : { type: 'spring', stiffness: 260, damping: 30, mass: 0.9 }
          }
        >
          {pageEmperors.map((emperor, index) => (
            <EmperorCard key={emperor.id} emperor={emperor} index={index} />
          ))}
          {Array.from({ length: emptySlots }, (_, i) => (
            <div key={`empty-${i}`} className="emp-slot" aria-hidden="true" />
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
