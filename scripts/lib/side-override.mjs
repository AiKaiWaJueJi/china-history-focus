/**
 * 路线 side 的人工修正：个别行军序列的攻守与几何直觉相反（唐将庞玉在高墌列阵诱敌，
 * 起点落在西秦境内，被自动规则判成敌方），这里按史料点名纠正。
 * key = `dynasty:eventId:general`
 */
export const SIDE_OVERRIDE = {
  'sui:ev_sui_xqin:庞玉': 'qin',
}
