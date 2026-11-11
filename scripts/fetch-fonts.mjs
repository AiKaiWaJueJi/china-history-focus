/**
 * 字体子集化 + 自托管
 * ===========================================================================
 * 需求里有 fontStyle 字段（毛笔/篆书、汉隶、瘦金体、魏碑…），前端要"按字段换字体"。
 *
 * 现实约束：方正瘦金书、汉仪篆书是**商业字体**，不能直接打包分发。
 * 因此这里用四款可商用的开源中文字体做"字形气质"的近似映射：
 *
 *   毛笔 / 篆书 / 魏碑 / 颜体  → Ma Shan Zheng   （毛笔行楷，笔锋最足）
 *   瘦金 / 台阁 / 馆阁 / 汉隶  → ZCOOL XiaoWei   （细劲清瘦，最接近瘦金体骨架）
 *   行书 / 行楷                → Long Cang       （行书连笔）
 *   行草 / 草书                → Zhi Mang Xing   （草书飞动）
 *   楷书                       → 系统 KaiTi      （Windows 自带 simkai.ttf，零下载）
 *
 * 换成商业字体时：把 woff2 放进 public/fonts/，改 src/lib/fonts.ts 的映射表和
 * index.css 的 @font-face 即可，组件不用动。
 *
 * 体积控制：只请求"13 个朝代名"用到的字（约 17 个），每款字体 ~10-20KB。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const PROJECT = join(ROOT, '..')
const data = JSON.parse(readFileSync(join(PROJECT, 'src/data/history.data.json'), 'utf8'))

/** 需要以书法字体渲染的字符集合 */
const chars = [...new Set(data.dynasties.map((d) => d.name).join(''))].join('')

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'

const fetchFont = async (family, outName) => {
  const url = `https://fonts.googleapis.com/css2?family=${family}&display=swap&text=${encodeURIComponent(chars)}`
  const css = await (await fetch(url, { headers: { 'User-Agent': UA } })).text()
  const m = css.match(/src:\s*url\((https:\/\/[^)]+)\)/)
  if (!m) throw new Error(`no font url for ${family}: ${css.slice(0, 200)}`)
  const buf = Buffer.from(await (await fetch(m[1])).arrayBuffer())
  const dir = join(PROJECT, 'public/fonts')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, outName), buf)
  const cssFamily = (css.match(/font-family:\s*'([^']+)'/) ?? [])[1] ?? family
  console.log(`${cssFamily.padEnd(16)} ${chars.length} chars -> ${outName} ${(buf.length / 1024).toFixed(1)} KB`)
}

console.log(`用字: ${chars}  共 ${[...chars].length} 个`)
await fetchFont('Ma+Shan+Zheng', 'ma-shan-zheng.woff2')
await fetchFont('ZCOOL+XiaoWei', 'zcool-xiaowei.woff2')
await fetchFont('Long+Cang', 'long-cang.woff2')
await fetchFont('Zhi+Mang+Xing', 'zhi-mang-xing.woff2')
