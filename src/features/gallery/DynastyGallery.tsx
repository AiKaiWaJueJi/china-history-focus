/**
 * DynastyGallery —— 视图1：朝代主页
 * ===========================================================================
 * 布局：CSS Flex 横向排列 13 个朝代模块。
 * 挤压：默认 flex-grow:1；激活项 2.6，其余 0.8（数值来自需求）。
 *
 * 激活判定不再交给 CSS :hover，而是 useHoverIntent：
 * 因为挤压会移动布局，而布局移动会让 :hover 在静止光标下改判，
 * 造成"焦点自己跑到隔壁"的诡异体验（详见 useHoverIntent 的注释）。
 * 控制器只读写 data-active 属性，React 在交互期间依然零重渲染。
 */
import { useEffect } from 'react'
import { dataset } from '../../data'
import { useAppStore } from '../../store/useAppStore'
import { DynastyPanel } from './DynastyPanel'
import { useHoverIntent } from './useHoverIntent'

/**
 * 空闲预热（idle prewarm）
 * ---------------------------------------------------------------------------
 * 实测：首次激活时浏览器要把"放大后的背景层"提升为合成层并栅格化，
 * 会产生一次约 80ms 的单帧尖峰（第二、三次之后完全消失）。
 * 这里利用浏览器空闲时间逐个模块把展开态样式施加两帧再撤销，
 * 把这次栅格化提前到用户交互之前完成。
 */
function useIdlePrewarm() {
  useEffect(() => {
    const panels = Array.from(document.querySelectorAll<HTMLElement>('.dyn-panel'))
    if (panels.length === 0) return

    let index = 0
    let cancelled = false

    const schedule = (fn: () => void) => {
      const ric = (
        window as unknown as {
          requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
        }
      ).requestIdleCallback
      if (ric) ric(fn, { timeout: 1500 })
      else window.setTimeout(fn, 240)
    }

    const warmNext = () => {
      if (cancelled || index >= panels.length) return
      const el = panels[index++]
      el.dataset.prewarm = 'true'
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (cancelled) return
          delete el.dataset.prewarm
          schedule(warmNext)
        })
      })
    }

    schedule(warmNext)
    return () => {
      cancelled = true
      for (const el of panels) delete el.dataset.prewarm
    }
  }, [])
}

export function DynastyGallery() {
  const openDynasty = useAppStore((s) => s.openDynasty)
  const galleryRef = useHoverIntent({ dwellMs: 60 })
  useIdlePrewarm()

  return (
    <div className="gallery" ref={galleryRef}>
      {dataset.dynasties.map((dynasty, index) => (
        <DynastyPanel
          key={dynasty.id}
          dynasty={dynasty}
          index={index}
          onOpen={() => openDynasty(dynasty.id)}
        />
      ))}
    </div>
  )
}
