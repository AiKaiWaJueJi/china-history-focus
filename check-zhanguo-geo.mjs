/**
 * check-zhanguo-geo.mjs —— 战国版图几何验收（第三轮：真实省界底板）
 * 校验项见 scripts/lib/check-geo.mjs
 */
import { checkGeo } from './scripts/lib/check-geo.mjs'

const r = checkGeo('战国', 'zhanguo.geo.json', 'endgame.zhou.json')
console.log(`\n===== ${r.pass}/${r.pass + r.fail} passed =====`)
if (r.fail) process.exitCode = 1
