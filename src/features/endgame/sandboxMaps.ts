/**
 * 七朝沙盘的地图配置
 * ===========================================================================
 * 版图真源在 src/data/sui-unify.geo.json 等七份文件里，由 scripts/make-sandbox-geo.mjs
 * 用「同一块大陆轮廓（433135）+ 政权种子点 Voronoi 剖分」生成：
 * 相邻两块共用 bisector 端点，因此天然无缝、不重叠、面积守恒。
 *
 * 每份 geo 的 attacker 字段就是攻方，regions 是其余各块；本文件只做一层包装，
 * 让 EndgameStage 能像 zhanguo / chuhan / sanguo / sui 那样按 mapId 取 MapSpec。
 */
import suiUnifyGeo from '../../data/sui-unify.geo.json'
import tangWudaiGeo from '../../data/tang-wudai.geo.json'
import fdSongGeo from '../../data/fd-song.geo.json'
import songYuanGeo from '../../data/song-yuan.geo.json'
import yuanMingGeo from '../../data/yuan-ming.geo.json'
import mingQingGeo from '../../data/ming-qing.geo.json'
import qingXinhaiGeo from '../../data/qing-xinhai.geo.json'
import type { MapRegion, MapSpec } from './mapGeometry'

type Geo = {
  attacker: MapRegion & { id: string; name: string; points: string; label: [number, number] }
  regions: MapRegion[]
  rivers?: string[]
}

function toSpec(geo: Geo, ariaLabel: string, resetHint?: string): MapSpec {
  return {
    attacker: geo.attacker,
    regions: geo.regions,
    rivers: geo.rivers ?? [],
    ariaLabel,
    resetHint,
    points: [],
  }
}

export const SANDBOX_MAPS: Record<string, MapSpec> = {
  'sui-unify': toSpec(suiUnifyGeo as unknown as Geo, '隋末群雄与唐统一战争版图', '群雄复其疆'),
  'tang-wudai': toSpec(tangWudaiGeo as unknown as Geo, '唐末梁晋争霸版图', '诸镇复其疆'),
  'fd-song': toSpec(fdSongGeo as unknown as Geo, '五代末宋统一战争版图', '列国复其疆'),
  'song-yuan': toSpec(songYuanGeo as unknown as Geo, '元灭宋版图', '宋复其疆'),
  'yuan-ming': toSpec(yuanMingGeo as unknown as Geo, '明北伐灭元版图', '元复其疆'),
  'ming-qing': toSpec(mingQingGeo as unknown as Geo, '甲申之年各方版图', '群雄复其疆'),
  'qing-xinhai': toSpec(qingXinhaiGeo as unknown as Geo, '辛亥革命各省独立版图', '清复其疆'),
}
