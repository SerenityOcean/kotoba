import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { GITHUB_LOGIN_URL, fetchAuthFeatures } from '../api'
import type { AuthFeatures } from '../api'
import { useAuth } from '../auth-context'
import { Field, PasswordInput, SubmitButton, TextInput } from '../components/AuthFields'

type Mode = 'login' | 'register'

export default function LoginPage() {
  const [params] = useSearchParams()
  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  // GitHub 回跳失败时后端把人送到 /login?error=github
  const [error, setError] = useState<string | null>(
    params.get('error') === 'github' ? 'GitHub 登录没有成功，可以再试一次' : null,
  )
  const [submitting, setSubmitting] = useState(false)
  const [features, setFeatures] = useState<AuthFeatures | null>(null)

  const { login, register } = useAuth()
  // 登录成功后不用自己跳：登录态一变，App 里的 LoginRoute 会把人送回原来那页

  useEffect(() => {
    // 拿不到就当都没开，登录本身不受影响
    fetchAuthFeatures()
      .then(setFeatures)
      .catch(() => setFeatures({ email: false, github: false }))
  }, [])

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setConfirm('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return

    if (username.trim() === '' || password === '') {
      setError('用户名和密码都要填')
      return
    }
    // 和后端的校验规则对齐，能在本地拦下的就别跑一趟
    if (mode === 'register') {
      if (password.length < 8) {
        setError('密码至少 8 位')
        return
      }
      if (password !== confirm) {
        setError('两次输入的密码不一样')
        return
      }
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
        <Field label="用户名" hint={mode === 'register' ? '字母、数字、_ 和 -' : undefined}>
          <TextInput
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
          />
        </Field>

        <Field label="密码" hint={mode === 'register' ? '至少 8 位' : undefined}>
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </Field>

        {mode === 'register' && (
          <Field label="再输一遍密码">
            <PasswordInput
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
        )}

        {error && <p className="text-sm text-shu">{error}</p>}

        <SubmitButton busy={submitting}>{mode === 'login' ? '登录' : '注册并登录'}</SubmitButton>
      </form>

      {features?.github && (
        <a
          href={GITHUB_LOGIN_URL}
          className="mt-4 block w-full rounded-sm border border-usu px-8 py-3 text-center text-sm text-sumi transition hover:border-sumi"
        >
          用 GitHub {mode === 'login' ? '登录' : '注册'}
        </a>
      )}

      <div className="mt-8 flex items-baseline justify-between gap-4 text-xs leading-relaxed text-hai">
        <p>登录状态保留 30 天，同一台设备不用反复登。</p>
        {mode === 'login' && features?.email && (
          <Link to="/forgot-password" className="shrink-0 transition hover:text-sumi">
            忘记密码？
          </Link>
        )}
      </div>
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
