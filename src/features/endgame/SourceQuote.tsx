/**
 * SourceQuote —— 史料原文（古籍引文）
 * ===========================================================================
 * 设计意图：战报三段是现代叙述，这一块是**原始史料**。
 * 两者并置，读者可以自己对照"史书写了什么"与"我们怎么讲"。
 *
 * 版式：竖排（writing-mode: vertical-rl）+ 竹简条纹底。
 * 竖排是古籍的阅读方式，条纹让每一列看起来像一枚竹简；
 * 条纹周期与行宽对齐，字列正好落在简面上。
 *
 * 高度自适应：
 *   竖排里"高度"决定每列能放几个字。写死高度有两种坏处——
 *   太矮：列数暴增，横向撑破容器；太高：短引文留一片空白。
 *   所以从 96px 起，每次加 10px，直到横向不再溢出；上限 300px，
 *   再长就交给战报栏滚动，不让一段引文占满整屏。
 *
 * 交互：悬浮（或键盘聚焦）时浮出今译，不打断阅读。
 */
import { useEffect, useRef, useState } from 'react'

interface SourceQuoteProps {
  bookName: string
  text: string
  translation: string
}

export function SourceQuote({ bookName, text, translation }: SourceQuoteProps) {
  const textRef = useRef<HTMLParagraphElement>(null)
  const [height, setHeight] = useState(132)

  useEffect(() => {
    const el = textRef.current
    if (!el) return

    let h = 96
    el.style.height = `${h}px`
    // 量到"横向不溢出"为止；每步 10px，最多到 300px
    while (el.scrollWidth > el.clientWidth + 1 && h < 300) {
      h += 10
      el.style.height = `${h}px`
    }
    setHeight(h)
  }, [text])

  return (
    <figure className="source-quote">
      <figcaption className="source-book">
        <span className="source-book-name">{bookName}</span>
        <span className="source-book-tag">原文</span>
      </figcaption>

      <div className="source-body" tabIndex={0} aria-describedby="source-translation">
        <p className="source-text" ref={textRef} style={{ height }}>
          {text}
        </p>

        <div className="source-tooltip" role="tooltip" id="source-translation">
          <span className="source-tooltip-label">今译</span>
          <p className="source-tooltip-text">{translation}</p>
        </div>
      </div>
    </figure>
  )
}
