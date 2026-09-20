import { useState } from 'react'
import { useAuth } from '../auth-context'

type Mode = 'login' | 'register'

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const { login, register } = useAuth()
  // 登录成功后不用自己跳：登录态一变，App 里的 LoginRoute 会把人送回原来那页

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return

    if (username.trim() === '' || password === '') {
      setError('用户名和密码都要填')
      return
    }
    // 和后端的校验规则对齐，能在本地拦下的就别跑一趟
    if (mode === 'register' && password.length < 8) {
      setError('密码至少 8 位')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      if (mode === 'login') {
        await login(username.trim(), password)
      } else {
        await register(username.trim(), password)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="py-4 sm:py-8">
      <div className="mb-8 flex gap-6 text-sm">
        <ModeTab active={mode === 'login'} onClick={() => switchMode('login')}>
          登录
        </ModeTab>
        <ModeTab active={mode === 'register'} onClick={() => switchMode('register')}>
          注册
        </ModeTab>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="用户名">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            className="w-full border-b border-usu bg-transparent py-2 text-lg outline-none transition focus:border-sumi"
          />
        </Field>

        <Field label="密码" hint={mode === 'register' ? '至少 8 位' : undefined}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className="w-full border-b border-usu bg-transparent py-2 text-lg outline-none transition focus:border-sumi"
          />
        </Field>

        {error && <p className="text-sm text-shu">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-sm bg-ai px-8 py-3 text-sm text-washi transition hover:opacity-85 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ai"
        >
          {submitting ? '请稍候…' : mode === 'login' ? '登录' : '注册并登录'}
        </button>
      </form>

      <p className="mt-8 text-xs leading-relaxed text-hai">
        {mode === 'login'
          ? '登录状态保留 30 天，同一台设备不用反复登。'
          : '第一次用的话，用你数据库里那个用户名注册，原来的卡片会跟着留下。'}
      </p>
    </div>
  )
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'border-b border-sumi pb-0.5 text-sumi'
          : 'border-b border-transparent pb-0.5 text-hai transition hover:text-sumi'
      }
    >
      {children}
    </button>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="text-xs tracking-wider text-hai">
        {label}
        {hint && <span className="ml-2 opacity-70">{hint}</span>}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  )
}
