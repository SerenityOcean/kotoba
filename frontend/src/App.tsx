import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import HomePage from './pages/HomePage'
import ReviewPage from './pages/ReviewPage'
import CardsPage from './pages/CardsPage'
import AnalyzePage from './pages/AnalyzePage'
import ArticlesPage from './pages/ArticlesPage'
import ArticlePage from './pages/ArticlePage'
import LoginPage from './pages/LoginPage'
import { useAuth } from './auth-context'

export default function App() {
  const { user, ready } = useAuth()

  return (
    <div className="min-h-screen bg-washi font-ui text-sumi">
      <div className="mx-auto max-w-xl px-4 py-10 sm:px-6 sm:py-20">
        <header className="mb-8 flex items-baseline justify-between sm:mb-10">
          <div>
            <h1 className="font-mincho text-2xl tracking-[0.3em] sm:text-3xl">言葉</h1>
            <p className="mt-1 text-xs tracking-widest text-hai">KOTOBA</p>
          </div>

          {user && (
            <nav className="flex items-baseline gap-5 text-sm">
              <NavItem to="/" end>
                首页
              </NavItem>
              <NavItem to="/reading">阅读</NavItem>
              <NavItem to="/analyze">拆解</NavItem>
              <NavItem to="/cards">卡片</NavItem>
              <UserMenu />
            </nav>
          )}
        </header>

        {/* 还没问出"我是谁"之前先别渲染路由，否则会闪一下登录页 */}
        {!ready ? (
          <p className="text-sm text-hai">加载中…</p>
        ) : (
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <HomePage />
                </RequireAuth>
              }
            />
            <Route
              path="/review"
              element={
                <RequireAuth>
                  <ReviewPage />
                </RequireAuth>
              }
            />
            <Route
              path="/reading"
              element={
                <RequireAuth>
                  <ArticlesPage />
                </RequireAuth>
              }
            />
            <Route
              path="/reading/:id"
              element={
                <RequireAuth>
                  <ArticlePage />
                </RequireAuth>
              }
            />
            <Route
              path="/analyze"
              element={
                <RequireAuth>
                  <AnalyzePage />
                </RequireAuth>
              }
            />
            <Route
              path="/cards"
              element={
                <RequireAuth>
                  <CardsPage />
                </RequireAuth>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        )}
      </div>
    </div>
  )
}

/**
 * 登录页。已经登录就别停在这儿了 —— 回到被拦下来的那一页。
 *
 * 跳转只在这里做：LoginPage 里再 navigate 一次的话，两边会抢，
 * 而登录成功引起的这次重渲染总是先到，结果永远落在首页。
 */
function LoginRoute() {
  const { user } = useAuth()
  const location = useLocation()

  if (user) {
    const from = (location.state as { from?: string } | null)?.from ?? '/'
    return <Navigate to={from} replace />
  }
  return <LoginPage />
}

/** 没登录就送去登录页，并记住本来要去哪儿。 */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return children
}

function UserMenu() {
  const { user, logout } = useAuth()

  return (
    <span className="flex items-baseline gap-2 border-l border-usu pl-5">
      <span className="text-hai">{user?.username}</span>
      <button
        onClick={() => logout()}
        className="text-xs text-hai transition hover:text-shu"
      >
        登出
      </button>
    </span>
  )
}

function NavItem({
  to,
  end = false,
  children,
}: {
  to: string
  end?: boolean
  children: React.ReactNode
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        isActive
          ? 'border-b border-sumi pb-0.5 text-sumi'
          : 'border-b border-transparent pb-0.5 text-hai transition hover:text-sumi'
      }
    >
      {children}
    </NavLink>
  )
}

function NotFound() {
  return (
    <div className="py-24 text-center">
      <p className="font-mincho text-2xl">这里什么也没有</p>
      <NavLink to="/" className="mt-6 inline-block text-sm text-ai hover:underline">
        回首页
      </NavLink>
    </div>
  )
}
