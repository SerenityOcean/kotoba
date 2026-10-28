import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { AuthProvider } from './auth'
import { GoalProvider } from './goal'
import ErrorBoundary from './components/ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* 最外层兜底：页头、登录态、self 出错时至少有个刷新按钮。各页的错误 App 里另有一层接住 */}
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <GoalProvider>
            <App />
          </GoalProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
