/**
 * FocusStage —— 四块固定容器的舞台
 * ===========================================================================
 * 布局方案：CSS Grid 固定四条列轨道，四块容器作为 grid item 常驻。
 *   ① 用 Grid 而非绝对定位，是为了让"焦点面板 scale(1.1)"放大时仍以原 cell
 *      中心为原点，不会因为绝对定位的 top/left 基准而整体偏移；
 *   ② 四块容器的 DOM 顺序 = 历史纵深顺序（朝代 → 皇帝 → 事件 → 人物），
 *      即使同层 z-index 相同，绘制顺序也符合阅读方向；
 *   ③ 舞台外层 `overflow: hidden` 防止 scale 放大产生滚动条，
 *      同时保留 `perspective` 以便后续升级为真实 3D 景深。
 */
import { DynastyPanel } from '../panels/DynastyPanel'
import { EmperorPanel } from '../panels/EmperorPanel'
import { EventPanel } from '../panels/EventPanel'
import { CharacterPanel } from '../panels/CharacterPanel'
import { DepthVignette } from './DepthVignette'
import { FocusLayer } from './FocusLayer'

export function FocusStage() {
  return (
    <div className="stage">
      {/* 景深光晕：纯装饰层，永远不吃事件 */}
      <DepthVignette />

      <FocusLayer level="dynasty">
        <DynastyPanel />
      </FocusLayer>

      <FocusLayer level="emperor">
        <EmperorPanel />
      </FocusLayer>

      <FocusLayer level="event">
        <EventPanel />
      </FocusLayer>

      <FocusLayer level="character">
        <CharacterPanel />
      </FocusLayer>
    </div>
  )
}
