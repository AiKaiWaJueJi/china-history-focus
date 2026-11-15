/**
 * check-sui-geo.mjs —— 南北朝版图几何验收（第三轮：真实省界底板）
 * 校验项见 scripts/lib/check-geo.mjs
 */
import { checkGeo } from './scripts/lib/check-geo.mjs'

const r = checkGeo('南北朝', 'sui.geo.json', 'endgame.nanbei.json')
console.log(`\n===== ${r.pass}/${r.pass + r.fail} passed =====`)
if (r.fail) process.exitCode = 1
