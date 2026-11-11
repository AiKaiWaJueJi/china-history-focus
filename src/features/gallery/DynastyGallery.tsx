/**
 * DynastyGallery —— 视图1：朝代主页
 * ===========================================================================
 * 布局：CSS Flex 横向排列 5 个模块（需求：类似「5 个纵向并排的矩形」）。
 * 挤压：默认 flex-grow:1；悬停项 2，其余 0.8（数值来自需求原文）。
 *
 * 注意这里**没有** hover 状态、没有 motion 组件、没有事件监听。
 * 整个交互是声明式的 CSS：浏览器自己判断谁被悬停，然后把宽度重新分配。
 * React 在这期间是静止的，所以火焰图上看不到任何组件渲染。
 */
import { useEffect } from 'react'
import { dataset } from '../../data'
import { useAppStore } from '../../store/useAppStore'
import { DynastyPanel } from './DynastyPanel'

/**
 * 空闲预热（idle prewarm）
 * ---------------------------------------------------------------------------
 * 实测：第一次悬停时会出现一个约 80ms 的单帧尖峰，第二次之后完全消失
 * （见 measure-repeat.mjs 的对照数据：hover#1 max=81ms，hover#2/#3 max=6.5ms）。
 * 原因不是动画本身，而是浏览器**首次**把放大的背景层提升为合成层并栅格化。
 *
 * 处理办法：页面挂载后，利用浏览器空闲时间，逐个面板把"悬停态"的真实样式
 * 施加两帧再撤销，让这次栅格化在用户交互之前就发生。
 * 因为发生在空闲帧且逐面板串行，用户既看不到闪烁，也不会感知到卡顿；
 * 若用户预热完成前就悬停，最坏情况只是回到原来的一次性尖峰。
 */
function useIdlePrewarm() {
  useEffect(() => {
    const panels = Array.from(document.querySelectorAll<HTMLElement>('.dyn-panel'))
    if (panels.length === 0) return

    let index = 0
    let cancelled = false

    const schedule = (fn: () => void) => {
      const ric = (window as unknown as {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      }).requestIdleCallback
      if (ric) ric(fn, { timeout: 1500 })
      else window.setTimeout(fn, 240)
    }

    const warmNext = () => {
      if (cancelled || index >= panels.length) return
      const el = panels[index++]
      el.dataset.prewarm = 'true'
      // 两帧：第一帧提交样式，第二帧完成绘制/栅格化
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
  useIdlePrewarm()

  return (
    <div className="gallery">
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
