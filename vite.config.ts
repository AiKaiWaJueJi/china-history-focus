import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // 图标库等第三方包各自声明 react 为 peer，去重可避免多份 React 实例
    dedupe: ['react', 'react-dom'],
  },
})
