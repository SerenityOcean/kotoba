import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import HomePage from './pages/HomePage'
import ReviewPage from './pages/ReviewPage'
import CardsPage from './pages/CardsPage'
import AnalyzePage from './pages/AnalyzePage'
import ArticlesPage from './pages/ArticlesPage'
import ArticlePage from './pages/ArticlePage'
import LoginPage from './pages/LoginPage'
import HiganPage from './pages/HiganPage'
import { useAuth } from './auth-context'
import { useGoal } from './goal-context'
import { countdown } from './goal-time'

export default function App() {
  const { user, ready } = useAuth()
  const location = useLocation()

  // 读文章时给宽屏留出第二栏放拆解面板；其余页面维持易读的窄栏宽度
  const wide = /^\/reading\/[^/]+$/.test(location.pathname)
  // 登录页只有一块内容，没有导航在右边配重，靠左排会明显偏心 —— 单独收窄居中
  const centered = location.pathname === '/login'

  const width = centered ? 'max-w-sm' : wide ? 'max-w-6xl' : 'max-w-3xl'

  return (
    <div className="min-h-screen bg-washi font-ui text-sumi">
      <div className={`mx-auto px-4 py-10 sm:px-8 sm:py-16 ${width}`}>
        <header
          className={`mb-12 flex flex-wrap items-end gap-x-8 gap-y-5 sm:mb-16 ${
            centered ? 'justify-center text-center' : 'justify-between'
          }`}
        >
          <div>
            <h1 className="font-mincho text-4xl leading-none tracking-[0.35em] sm:text-5xl">
              言葉
            </h1>
            <p className="mt-3 text-[0.65rem] tracking-[0.55em] text-hai">KOTOBA</p>
          </div>

          {user && (
            <div className="flex flex-col items-start gap-4 sm:items-end">
              <GoalCountdown />
              <nav className="flex items-baseline gap-6 text-sm">
                <NavItem to="/" end>
                  首页
                </NavItem>
                <NavItem to="/reading">阅读</NavItem>
                <NavItem to="/analyze">拆解</NavItem>
                <NavItem to="/cards">卡片</NavItem>
                <NavItem to="/higan">彼岸</NavItem>
                <UserMenu />
              </nav>
            </div>
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
            <Route
              path="/higan"
              element={
                <RequireAuth>
                  <HiganPage />
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

/**
 * 导航上方那一行：离彼岸还有几周几天。每个页面都看得到，所以要足够轻 ——
 * 没立目标、或者目标日已经过了，就什么都不显示，也不催人去立。
 */
function GoalCountdown() {
  const { goal } = useGoal()
  if (!goal) return null

  const { days, weeks } = countdown(goal)
  if (days < 0) return null

  return (
    <NavLink
      to="/higan"
      title={`目标日 ${goal.targetDate}`}
      className="group flex items-baseline gap-3 text-hai transition hover:text-sumi"
    >
      <span className="max-w-[12em] truncate text-xs tracking-wider">{goal.title}</span>
      {days === 0 ? (
        <span className="font-mincho text-lg text-ai">就是今天</span>
      ) : (
        <span className="text-xs">
          <span className="font-mincho text-lg tabular-nums text-sumi">{weeks}</span> 周
          <span className="mx-1.5 text-usu group-hover:text-hai">·</span>
          <span className="font-mincho text-lg tabular-nums text-sumi">{days}</span> 天
        </span>
      )}
    </NavLink>
  )
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
