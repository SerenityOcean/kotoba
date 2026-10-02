import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import SelfPage from './SelfPage'
import SelfWritePage from './SelfWritePage'
import './self.css'

/**
 * /self 下面的一切。和 Kotoba 不共用页头、导航和样式 —— 是另一个地方。
 * 整块按需加载：只逛 Kotoba 的人不会下载到这里的代码和样式。
 */
export default function SelfApp() {
  useEffect(() => {
    const previous = document.title
    document.title = 'self'
    return () => {
      document.title = previous
    }
  }, [])

  return (
    <Routes>
      <Route index element={<SelfPage />} />
      <Route path="write" element={<SelfWritePage />} />
      {/* 手滑拼成 wright 也能到 */}
      <Route path="wright" element={<Navigate to="/self/write" replace />} />
      <Route path="*" element={<Navigate to="/self" replace />} />
    </Routes>
  )
}
