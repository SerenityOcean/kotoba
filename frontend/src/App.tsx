import { lazy, Suspense, useEffect } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import ReviewPage from './pages/ReviewPage'
import CardsPage from './pages/CardsPage'
import AnalyzePage from './pages/AnalyzePage'
import ArticlesPage from './pages/ArticlesPage'
import ArticlePage from './pages/ArticlePage'
import ArticleEditPage from './pages/ArticleEditPage'
import ExamsPage from './pages/ExamsPage'
import ExamPage from './pages/ExamPage'
import LoginPage from './pages/LoginPage'
import HiganPage from './pages/HiganPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import VerifyEmailPage from './pages/VerifyEmailPage'
import AccountPage from './pages/AccountPage'
import LandingPage from './pages/LandingPage'
import LibraryPage from './pages/LibraryPage'
import PackPage from './pages/PackPage'
import EssayPage, { PackTrialPage } from './pages/EssayPage'
import ErrorBoundary from './components/ErrorBoundary'
import { useAuth } from './auth-context'
import { useGoal } from './goal-context'
import { countdown } from './goal-time'
import { KOTOBA_THEME_KEY, useThemeState } from './theme'
import type { Theme } from './theme'

/** 没登录时用的那几页：只有一块表单，收窄居中。 */
const SIGNED_OUT_PAGES = ['/login', '/forgot-password', '/reset-password', '/verify-email']

/** self 是另一个地方，按需加载，Kotoba 的包里不带它。 */
const SelfApp = lazy(() => import('./self/SelfApp'))

export default function App() {
  return (
    <Routes>
      {/* self 不要 Kotoba 的页头和导航，也不用等登录态 —— 谁都能看 */}
      <Route
        path="/self/*"
        element={
          <Suspense fallback={null}>
            <SelfApp />
          </Suspense>
        }
      />
      {/* 资料里的随笔、试读：沉浸着读，也不要 Kotoba 的页头。谁都能读的随笔没登录也能打开 */}
      <Route path="/essay/:slug" element={<EssayPage />} />
      <Route
        path="/library/:slug/trial"
        element={
          <AfterAuth>
            <RequireAuth>
              <PackTrialPage />
            </RequireAuth>
          </AfterAuth>
        }
      />
      <Route path="*" element={<Kotoba />} />
    </Routes>
  )
}

/** Kotoba 的壳外面没有「加载中」那一道：问清是谁之前先别渲染，免得闪一下登录页 */
function AfterAuth({ children }: { children: React.ReactNode }) {
  const { ready } = useAuth()
  return ready ? children : null
}

function Kotoba() {
  const { user, ready } = useAuth()
  const location = useLocation()
  const { theme, toggle } = useThemeState(KOTOBA_THEME_KEY)

  // 挂在 <html> 上，弹层、body 也一起换色。去 self 时摘掉 —— 那边有自己的昼夜
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.dataset.theme = 'dark'
    else delete root.dataset.theme
    return () => {
      delete root.dataset.theme
    }
  }, [theme])

  // 读文章、做卷子时给宽屏留出第二栏放拆解面板；其余页面维持易读的窄栏宽度
  const wide = /^\/(?:reading|exam)\/[^/]+$/.test(location.pathname)
  // 登录页只有一块内容，没有导航在右边配重，靠左排会明显偏心 —— 单独收窄居中
  // 找回密码、邮件链接落地页同理；但已登录的人点开邮件链接时照常显示导航
  const centered = !user && SIGNED_OUT_PAGES.includes(location.pathname)
  // 没登录时的首页是展示页：舞台和下面那排功能要宽一些
  const landing = ready && !user && location.pathname === '/'

  // 资料页的卡片两列排，和展示页一样宽一些
  const library = /^\/library(?:\/[^/]+)?$/.test(location.pathname)

  const width = centered ? 'max-w-sm' : wide ? 'max-w-6xl' : landing || library ? 'max-w-5xl' : 'max-w-3xl'

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
            // 手机上标题和导航挤不下一行：导航单独占一整行放到标题下面，
            // 否则每个链接会被压成一个字一行
            <div className="flex w-full flex-col items-start gap-4 sm:w-auto sm:items-end">
              <GoalCountdown />
              <nav className="flex w-full flex-wrap items-baseline gap-x-5 gap-y-3 text-sm sm:w-auto sm:gap-x-6">
                <NavItem to="/" end>
                  首页
                </NavItem>
                <NavItem to="/reading">阅读</NavItem>
                <NavItem to="/exam">应试</NavItem>
                <NavItem to="/analyze">拆解</NavItem>
                <NavItem to="/cards">卡片</NavItem>
                <NavItem to="/higan">彼岸</NavItem>
                <NavItem to="/library">资料</NavItem>
                <UserMenu theme={theme} onToggleTheme={toggle} />
              </nav>
            </div>
          )}

          {landing && (
            <nav className="flex items-baseline gap-5 text-sm">
              <Link to="/login" className="text-hai transition hover:text-sumi">
                登录
              </Link>
              <Link to="/login?mode=register" className="text-hai transition hover:text-sumi">
                注册
              </Link>
              <ThemeButton theme={theme} onToggle={toggle} />
            </nav>
          )}
        </header>

        {user?.demo && <DemoBanner />}

        {/* 某一页渲染出错时只换掉这一块，页头和导航还在，点去别页就恢复 */}
        <ErrorBoundary resetKey={location.pathname}>
          {/* 还没问出"我是谁"之前先别渲染路由，否则会闪一下登录页 */}
          {!ready ? (
            <p className="text-sm text-hai">加载中…</p>
          ) : (
            <Routes>
              <Route path="/login" element={<LoginRoute />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              {/* 这两个是邮件链接的落地页，登没登录都能打开 */}
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route
                path="/account"
                element={
                  <RequireAuth>
                    {/* 体验账号大家共用，账号设置一概不开放（后端也拦着） */}
                    {user?.demo ? <DemoAccountNotice /> : <AccountPage />}
                  </RequireAuth>
                }
              />
              {/* 没登录的人看到的首页是展示页，不再直接跳去登录 */}
              <Route path="/" element={user ? <HomePage /> : <LandingPage />} />
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
                path="/reading/:id/edit"
                element={
                  <RequireAuth>
                    <ArticleEditPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/exam"
                element={
                  <RequireAuth>
                    <ExamsPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/exam/:id"
                element={
                  <RequireAuth>
                    <ExamPage />
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
              <Route
                path="/library"
                element={
                  <RequireAuth>
                    <LibraryPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/library/:slug"
                element={
                  <RequireAuth>
                    <PackPage />
                  </RequireAuth>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          )}
        </ErrorBoundary>
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
  // ?mode=register 变了就换一个新的登录页：已经停在 /login 时点「注册」也能切过去
  return <LoginPage key={location.search} />
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

function UserMenu({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const { user, logout } = useAuth()

  return (
    // 手机上推到这一行最右边；宽屏照旧跟在导航后面，用竖线隔开
    <span className="ml-auto flex items-baseline gap-2 whitespace-nowrap sm:ml-0 sm:border-l sm:border-usu sm:pl-5">
      <NavLink
        to="/account"
        title="账号设置"
        className={({ isActive }) =>
          isActive ? 'text-sumi' : 'text-hai transition hover:text-sumi'
        }
      >
        {user?.username}
      </NavLink>
      <ThemeButton theme={theme} onToggle={onToggleTheme} />
      <button
        onClick={() => logout()}
        className="text-xs text-hai transition hover:text-shu"
      >
        登出
      </button>
    </span>
  )
}

/** 昼夜切换。显示的是点了会切到的那一边 */
function ThemeButton({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      title={theme === 'dark' ? '切到日间模式' : '切到夜间模式'}
      aria-label={theme === 'dark' ? '切到日间模式' : '切到夜间模式'}
      className="font-mincho text-xs text-hai transition hover:text-ai"
    >
      {theme === 'dark' ? '昼' : '夜'}
    </button>
  )
}

/**
 * 体验账号登着的时候，页头下面一直挂着这一行。
 *
 * 「注册一个」要先登出：注册页只给没登录的人看。登出前先回首页 —— 停在要登录的页上登出的话，
 * 那一页的 <Navigate to="/login"> 会在 effect 里晚一步跳，把后面去注册页的这一跳盖掉。
 */
function DemoBanner() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  return (
    <p className="-mt-6 mb-12 border-l-2 border-ai pl-4 text-xs leading-relaxed text-hai sm:-mt-8 sm:mb-14">
      这是大家共用的体验账号：随便看，改动不会存下来，复习的评分也不存。
      <button
        onClick={async () => {
          navigate('/')
          await logout()
          navigate('/login?mode=register')
        }}
        className="ml-1 text-ai underline-offset-4 hover:underline"
      >
        注册一个自己的 →
      </button>
    </p>
  )
}

function DemoAccountNotice() {
  return (
    <div className="py-20 text-center">
      <p className="font-mincho text-2xl">体验账号没有账号设置</p>
      <p className="mt-4 text-sm leading-relaxed text-hai">
        大家共用这一个号，改密码、绑邮箱、管登录设备都不开放。
      </p>
    </div>
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
          ? 'whitespace-nowrap border-b border-sumi pb-0.5 text-sumi'
          : 'whitespace-nowrap border-b border-transparent pb-0.5 text-hai transition hover:text-sumi'
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
