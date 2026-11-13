/**
 * SourceQuote —— 史料原文（古籍引文）
 * ===========================================================================
 * 设计意图：战报三段是现代叙述，这一块是**原始史料**。
 * 两者并置，读者可以自己对照"史书写了什么"与"我们怎么讲"。
 *
 * 版式：竖排（writing-mode: vertical-rl）+ 竹简条纹底。
 * 竖排是古籍的阅读方式，条纹让每一列看起来像一枚竹简；
 * 条纹周期（34px）与行宽对齐，字列正好落在简面上。
 *
 * 交互：悬浮（或键盘聚焦）时浮出今译，不打断阅读。
 */
interface SourceQuoteProps {
  bookName: string
  text: string
  translation: string
}

export function SourceQuote({ bookName, text, translation }: SourceQuoteProps) {
  return (
    <figure className="source-quote">
      <figcaption className="source-book">
        <span className="source-book-name">{bookName}</span>
        <span className="source-book-tag">原文</span>
      </figcaption>

      <div className="source-body" tabIndex={0} aria-describedby="source-translation">
        <p className="source-text">{text}</p>

        <div className="source-tooltip" role="tooltip" id="source-translation">
          <span className="source-tooltip-label">今译</span>
          <p className="source-tooltip-text">{translation}</p>
        </div>
      </div>
    </figure>
  )
}
