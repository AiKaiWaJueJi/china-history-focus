/**
 * check-chuhan-geo.mjs —— 楚汉版图几何验收（第三轮：真实省界底板）
 * 校验项见 scripts/lib/check-geo.mjs
 */
import { checkGeo } from './scripts/lib/check-geo.mjs'

const r = checkGeo('楚汉', 'chuhan.geo.json', 'endgame.chuhan.json')
console.log(`\n===== ${r.pass}/${r.pass + r.fail} passed =====`)
if (r.fail) process.exitCode = 1
