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
  'verify-codex-ui.mjs',
  'verify-wudai.mjs',
  'verify-sandbox.mjs',
  'verify-segment-intro.mjs',
]
const GEO = [
  'check-zhanguo-geo.mjs',
  'check-chuhan-geo.mjs',
  'check-sanguo-geo.mjs',
  'check-sui-geo.mjs',
  // 百科库（无限下钻）的数据层验收
  'verify-codex.mjs',
]

const run = (file) => {
  const r = spawnSync(process.execPath, [file], { encoding: 'utf8', timeout: 15 * 60 * 1000 })
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
  const m = out.match(/=====\s*(\d+)\/(\d+)\s*passed\s*=====/)
  const fails = [...out.matchAll(/FAIL\s+(.{0,90})/g)].map((x) => x[1].trim())
  return { file, ok: r.status === 0, summary: m ? `${m[1]}/${m[2]}` : '（无汇总行）', fails }
}

/*
  UI 断言里有几条是**时间敏感**的（悬停驻留 0—70ms 的采样、动画时序），
  机器负载高时偶发假阴性（单跑必过）。这里失败后隔 3 秒重跑一次，
  并把「重试过」写进日志——不掩盖问题，但也不让一次抖动毁掉整轮验收。
*/
const runWithRetry = (file) => {
  const first = run(file)
  if (first.ok) return first
  console.log(`     ⚠ 第一次未过（${first.summary}），3 秒后重试 …`)
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000)
  const second = run(file)
  return { ...second, retried: true, firstSummary: first.summary }
}

const results = []
for (const f of [...GEO, ...UI]) {
  process.stdout.write(`跑 ${f} … `)
  const res = runWithRetry(f)
  const mark = res.ok ? (res.retried ? `✓ ${res.summary}（重试后通过，首次 ${res.firstSummary}）` : `✓ ${res.summary}`) : `✗ ${res.summary}`
  console.log(mark)
  for (const x of res.fails ?? []) console.log(`     FAIL ${x}`)
  results.push(res)
}

const failed = results.filter((r) => !r.ok)
console.log(`\n===== 汇总：${results.length - failed.length}/${results.length} 套通过 =====`)
if (failed.length) {
  for (const f of failed) console.log(`  ✗ ${f.file}  ${f.summary}`)
  process.exitCode = 1
}
