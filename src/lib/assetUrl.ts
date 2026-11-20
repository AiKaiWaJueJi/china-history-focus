/**
 * assetUrl —— 把数据里写的 `/portraits/xxx.svg` 这类**根路径**拼到部署子路径下
 * ===========================================================================
 * 为什么需要：数据里的 imagem 路径是 `/portraits/...`（以根为基准），dev 跑在 `/` 上没问题，
 * 但线上是 GitHub Pages 的子路径 `/china-history-focus/`，于是 `/portraits/song-taizu.svg`
 * 会去请求 `https://<user>.github.io/portraits/...` —— 全站 251 张画像线上全是 404，
 * 卡片只剩底色。2026-11-21 部署复核时发现（此前一直只在 dev 里看图，没注意）。
 *
 * 口径：只用 `import.meta.env.BASE_URL`（vite 注入，dev 是 `/`，build 是 `/china-history-focus/`），
 * 不在代码里写死仓库名。
 */
const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '')

export function assetUrl(path: string | undefined): string {
  if (!path) return ''
  /* 已经是绝对 URL 或带了子路径的，原样返回 */
  if (/^(https?:)?\/\//.test(path) || path.startsWith(BASE) && BASE !== '') return path
  return path.startsWith('/') ? `${BASE}${path}` : path
}
