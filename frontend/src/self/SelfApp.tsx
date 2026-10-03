import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import SelfPage from './SelfPage'
import SelfWritePage from './SelfWritePage'
import { ThemeContext, useThemeState } from './theme'
import './self.css'

/**
 * /self 下面的一切。和 Kotoba 不共用页头、导航和样式 —— 是另一个地方。
 * 整块按需加载：只逛 Kotoba 的人不会下载到这里的代码和样式。
 */
export default function SelfApp() {
  const themeState = useThemeState()
  const { theme } = themeState

  // 页面滚过头（回弹）时露出来的是 body，让它和天色一致，夜里别闪出一道白
  useEffect(() => {
    const body = document.body.style
    const previous = body.backgroundColor
    body.backgroundColor = theme === 'dark' ? '#050914' : '#f7f1ea'
    return () => {
      body.backgroundColor = previous
    }
  }, [theme])

  useEffect(() => {
    const previous = document.title
    document.title = 'self'
    return () => {
      document.title = previous
    }
  }, [])

  return (
    <ThemeContext.Provider value={themeState}>
      <div data-self-theme={theme}>
        <Routes>
          <Route index element={<SelfPage />} />
          <Route path="write" element={<SelfWritePage />} />
          {/* 手滑拼成 wright 也能到 */}
          <Route path="wright" element={<Navigate to="/self/write" replace />} />
          <Route path="*" element={<Navigate to="/self" replace />} />
        </Routes>
      </div>
    </ThemeContext.Provider>
  )
}
