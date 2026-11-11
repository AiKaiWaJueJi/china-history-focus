import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/*
      阶段一是纯 CSS 驱动的挤压动画（零 React 重渲染），因此这里不挂 MotionConfig。
      阶段二引入滚轮翻页的 AnimatePresence 时再回来，届时 framer-motion 才真正参与。
    */}
    <App />
  </StrictMode>,
)
