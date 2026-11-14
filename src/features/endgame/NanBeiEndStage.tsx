import endgame from '../../data/nanbei.chronicle.json'
import { JinChronicleStage, type ChronicleData } from './JinChronicleStage'

/** 南北朝收尾沙盘：577 周灭齐 → 581 隋代周 → 589 隋灭陈 */
export function NanBeiEndStage() {
  return <JinChronicleStage data={endgame as ChronicleData} />
}
