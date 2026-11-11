/**
 * 字体子集化 + 自托管
 * ===========================================================================
 * 阶段二新增「周朝 37 位君主」后，用字集合扩大到谥号与姓名，
 * 所以这里改为统一从数据文件里抽取所有需要书法字体的字符，再重新子集化。
 *
 * 用字来源：
 *   1. 13 个朝代名
 *   2. 周朝 37 位君主的谥号 + 姓名
 *   3. 界面固定文案（时间轴、在位、第 X 页等）
 *
 * 体积极小（几十 KB），且完全离线可用；子集外的字会自动回落到系统楷体。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const PROJECT = join(ROOT, '..')

const dynasties = JSON.parse(readFileSync(join(PROJECT, 'src/data/history.data.json'), 'utf8'))
const zhou = JSON.parse(readFileSync(join(PROJECT, 'src/data/emperors.zhou.json'), 'utf8'))

const UI_TEXT = '周帝王时间轴在位第页共位事件史事返回朝代年至今前后'

const chars = [
  ...new Set(
    [
      ...dynasties.dynasties.map((d) => d.name),
      ...zhou.emperors.map((e) => e.posthumousTitle + e.personalName),
      UI_TEXT,
    ]
      .join('')
      .split(''),
  ),
].join('')

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

console.log(`用字 ${[...chars].length} 个`)
await fetchFont('Ma+Shan+Zheng', 'ma-shan-zheng.woff2')
await fetchFont('ZCOOL+XiaoWei', 'zcool-xiaowei.woff2')
await fetchFont('Long+Cang', 'long-cang.woff2')
await fetchFont('Zhi+Mang+Xing', 'zhi-mang-xing.woff2')
