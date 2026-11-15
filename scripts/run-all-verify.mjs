/**
 * 全量验收：UI 22 套 + 几何 4 套，逐套跑并汇总
 * 用法：node scripts/run-all-verify.mjs
 */
import { spawnSync } from 'node:child_process'

const UI = [
  'verify-gallery.mjs',
  'verify-dwell.mjs',
  'verify-timeline.mjs',
  'verify-dual.mjs',
  'verify-fall.mjs',
  'verify-dongqian.mjs',
  'verify-qin.mjs',
  'verify-chuhan.mjs',
  'verify-sandbox-note.mjs',
  'verify-endgame.mjs',
  'verify-han.mjs',
  'verify-sanguo.mjs',
  'verify-map-points.mjs',
  'verify-han-visuals.mjs',
  'verify-jin.mjs',
  'verify-jin-sandbox.mjs',
  'verify-nanbei.mjs',
  'verify-nanbei-end.mjs',
  'verify-frame.mjs',
  'verify-wudai.mjs',
  'verify-sandbox.mjs',
  'verify-segment-intro.mjs',
]
const GEO = [
  'check-zhanguo-geo.mjs',
  'check-chuhan-geo.mjs',
  'check-sanguo-geo.mjs',
  'check-sui-geo.mjs',
]

const run = (file) => {
  const r = spawnSync(process.execPath, [file], { encoding: 'utf8', timeout: 15 * 60 * 1000 })
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
  const m = out.match(/=====\s*(\d+)\/(\d+)\s*passed\s*=====/)
  const fails = [...out.matchAll(/FAIL\s+(.{0,90})/g)].map((x) => x[1].trim())
  return { file, ok: r.status === 0, summary: m ? `${m[1]}/${m[2]}` : '（无汇总行）', fails }
}

const results = []
for (const f of [...GEO, ...UI]) {
  process.stdout.write(`跑 ${f} … `)
  const res = run(f)
  console.log(res.ok ? `✓ ${res.summary}` : `✗ ${res.summary}`)
  for (const x of res.fails) console.log(`     FAIL ${x}`)
  results.push(res)
}

const failed = results.filter((r) => !r.ok)
console.log(`\n===== 汇总：${results.length - failed.length}/${results.length} 套通过 =====`)
if (failed.length) {
  for (const f of failed) console.log(`  ✗ ${f.file}  ${f.summary}`)
  process.exitCode = 1
}
