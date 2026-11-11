import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/*
      MotionConfig 全局统一弹簧参数与降级策略：
      - reducedMotion="user" 尊重系统「减少动画」设置
      - 所有 motion 组件默认走同一套过渡，避免各处手写 transition 造成节奏不一致
    */}
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
)
