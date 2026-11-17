import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages 的仓库页挂在 /<repo>/ 子路径下，生产构建必须带上这个前缀，
  // 否则 dist/index.html 里引用的 /assets/* 会全部 404。
  // 本地 dev 仍走根路径 —— 验收脚本默认打 http://localhost:5180，不能让部署配置影响日常开发。
  // 将来若改用自定义域名（根路径），把这里改成 '/' 或改成读环境变量。
  base: command === 'build' ? '/china-history-focus/' : '/',
  plugins: [react()],
  resolve: {
    // 图标库等第三方包各自声明 react 为 peer，去重可避免多份 React 实例
    dedupe: ['react', 'react-dom'],
  },
}))
