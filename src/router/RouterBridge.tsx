/**
 * RouterBridge —— 把 react-router 的 navigate 注入到导航服务
 * ---------------------------------------------------------------------------
 * 挂载在 BrowserRouter 内部，仅此一个副作用，不渲染任何 DOM。
 */
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { setNavigator } from './navigation'

export function RouterBridge() {
  const navigate = useNavigate()

  useEffect(() => {
    setNavigator((to) => navigate(to))
    return () => setNavigator(null)
  }, [navigate])

  return null
}
