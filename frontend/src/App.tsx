import { NavLink, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage'
import ReviewPage from './pages/ReviewPage'
import CardsPage from './pages/CardsPage'

export default function App() {
  return (
    <div className="min-h-screen bg-washi font-ui text-sumi">
      <div className="mx-auto max-w-xl px-6 py-14 sm:py-20">
        <header className="mb-10 flex items-baseline justify-between">
          <div>
            <h1 className="font-mincho text-3xl tracking-[0.3em]">言葉</h1>
            <p className="mt-1 text-xs tracking-widest text-hai">KOTOBA</p>
          </div>

          <nav className="flex gap-5 text-sm">
            <NavItem to="/" end>
              首页
            </NavItem>
            <NavItem to="/cards">卡片</NavItem>
          </nav>
        </header>

        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/cards" element={<CardsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
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
      <NavLink
        to="/"
        className="mt-6 inline-block text-sm text-ai hover:underline"
      >
        回首页
      </NavLink>
    </div>
  )
}