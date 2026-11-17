/**
 * ErrorBoundary —— 渲染兜底，避免一处 render 抛错把整棵树卸载成黑屏
 * ===========================================================================
 * 背景：档案抽屉点「书同文」时因为条目缺 quotes 字段，`.map()` 抛 TypeError，
 * React 19 会把整个根树卸掉 —— 用户看到的就是**整页全黑、连返回都点不到**。
 * 数据层已经补齐字段，但这类事故的代价太大，所以再加一层结构性兜底：
 * 出错时只牺牲出错的那块（抽屉 / 页面），其余导航与返回仍然可用。
 *
 * 用法：包在需要局部隔离的子树外面，scope 写人类可读的范围名。
 * `onReset` 可选，用于「关闭抽屉 / 退回主页」这类让用户能继续走下去的动作。
 */
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  /** 出错范围的人类可读名，如「档案抽屉」「当前页面」 */
  scope: string
  children: ReactNode
  /** 兜底面板上第二个按钮的动作（如关闭抽屉 / 回主页）；不传则只有「重试」 */
  onReset?: () => void
  /** 第二个按钮的文案 */
  resetLabel?: string
  /** 浮层模式：兜底面板固定在右下（用于抽屉这类浮层，避免跑到页面流下方看不见） */
  floating?: boolean
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 留一条痕迹给开发者和验收脚本的 console 监听
    console.error(`[ErrorBoundary:${this.props.scope}]`, error, info.componentStack)
  }

  private retry = () => this.setState({ error: null })

  private reset = () => {
    this.props.onReset?.()
    this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className={`crash-panel${this.props.floating ? ' crash-panel--float' : ''}`} role="alert">
        <p className="crash-panel-title">这一块内容没能渲染出来</p>
        <p className="crash-panel-sub">
          {this.props.scope}出了问题，已被拦在这里；页面其他部分还能继续用。
        </p>
        <pre className="crash-panel-msg">{error.message}</pre>
        <div className="crash-panel-actions">
          <button type="button" className="crash-panel-btn" onClick={this.retry}>
            重试
          </button>
          {this.props.onReset ? (
            <button type="button" className="crash-panel-btn crash-panel-btn--ghost" onClick={this.reset}>
              {this.props.resetLabel ?? '关掉它'}
            </button>
          ) : null}
        </div>
      </div>
    )
  }
}
