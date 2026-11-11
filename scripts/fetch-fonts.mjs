/**
 * 字体子集化 + 自托管
 * ---------------------------------------------------------------------------
 * 为什么不直接 <link> Google Fonts 的 CSS：
 *   1. 中文字体被切成 92 个 unicode-range 分片，运行时最多要发几十个请求；
 *   2. 国内网络下 fonts.googleapis.com / gstatic.com 经常不可达，
 *      页面会退化成系统楷体，视觉直接垮掉；
 *   3. 引入外部域名还会让首屏多一次 DNS + TLS 往返。
 *
 * 做法：用 Google Fonts 的 `text=` 参数只请求本项目**真正用到**的字符，
 * 得到单个微型 woff2，落到 public/fonts/ 里自托管。
 * 本项目用字集合是闭集（朝代名 + 谥号 + 姓名 + 少量标签），因此体积极小、永不缺字。
 *
 * 注意：后续若新增了字库外的汉字，需要重跑本脚本。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const PROJECT = join(ROOT, '..')
const data = JSON.parse(readFileSync(join(PROJECT, 'src/data/history.data.json'), 'utf8'))

/** 界面里以毛笔字/瘦金体渲染的文本，全部来自这里 */
const UI_CHARS = '中国历史多维朝代帝王纪年返回首页始末'

const collect = (values) => {
  const set = new Set()
  for (const v of values) for (const ch of v) set.add(ch)
  return set
}

const brushChars = [
  ...collect(data.dynasties.map((d) => d.name + d.alias)),
  ...collect([UI_CHARS]),
].join('')

const thinChars = [
  ...collect(data.emperors.map((e) => e.title + e.name)),
  ...collect([UI_CHARS]),
].join('')

/** 去重后按字符码排序，保证同一份数据每次生成同样的 URL（可复现） */
const uniq = (s) => [...new Set([...s])].sort().join('')

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'

const fetchFont = async (family, chars, outName) => {
  const text = uniq(chars)
  const url = `https://fonts.googleapis.com/css2?family=${family}&display=swap&text=${encodeURIComponent(text)}`
  const css = await (await fetch(url, { headers: { 'User-Agent': UA } })).text()
  // 注意：使用 text= 子集时，Google 返回的是 /l/font?kit=... 形式的地址（无 .woff2 后缀），
  // 所以这里不能用 \.woff2 收尾来匹配。
  const m = css.match(/src:\s*url\((https:\/\/[^)]+)\)/)
  if (!m) throw new Error(`no font url in css for ${family}: ${css.slice(0, 300)}`)
  const buf = Buffer.from(await (await fetch(m[1])).arrayBuffer())
  const dir = join(PROJECT, 'public/fonts')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, outName), buf)
  console.log(`${family}: ${text.length} chars -> ${outName} ${(buf.length / 1024).toFixed(1)} KB`)
  return m[1]
}

await fetchFont('Ma+Shan+Zheng', brushChars, 'ma-shan-zheng.woff2')
await fetchFont('ZCOOL+XiaoWei', thinChars, 'zcool-xiaowei.woff2')
