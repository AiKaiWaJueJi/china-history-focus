/**
 * fetch-doubao.mjs —— 从豆包 CDN 下载生成的原图
 * 用法：node scripts/fetch-doubao.mjs <url> <输出路径>
 * 说明：URL 带签名与过期时间，必须在生成后尽快下；下载的是 2848×1600 原图，
 *      右下角带「豆包 AI 生成」角标，随后由 fit-frame-images.py 裁掉。
 */
import { writeFileSync } from 'node:fs'

const [url, out] = process.argv.slice(2)
if (!url || !out) {
  console.error('用法：node scripts/fetch-doubao.mjs <url> <out.png>')
  process.exit(1)
}

const res = await fetch(url, {
  headers: {
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    referer: 'https://www.doubao.com/',
    accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
  },
})
if (!res.ok) {
  console.error(`下载失败 ${res.status} ${res.statusText}`)
  process.exit(1)
}
const buf = Buffer.from(await res.arrayBuffer())
writeFileSync(out, buf)
console.log(`${out}  ${(buf.length / 1024).toFixed(0)} KB  ${res.headers.get('content-type')}`)
