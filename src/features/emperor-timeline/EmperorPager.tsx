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
  enter: (dir: number) => ({ x: dir >= 0 ? '38%' : '-38%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir >= 0 ? '-38%' : '38%', opacity: 0 }),
}

export function EmperorPager({ emperors, pageIndex, direction, pageSize }: EmperorPagerProps) {
  const prefersReducedMotion = useReducedMotion()
  const start = pageIndex * pageSize
  const pageEmperors = emperors.slice(start, start + pageSize)
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
