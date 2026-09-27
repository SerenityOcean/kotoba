import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { resetPassword } from '../api'
import { useAuth } from '../auth-context'
import { Field, PasswordInput, SubmitButton } from '../components/AuthFields'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const { user, logout } = useAuth()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(
    token === '' ? '链接不完整，请从邮件里重新点开' : null,
  )
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting || token === '') return
    if (password.length < 8) {
      setError('密码至少 8 位')
      return
    }
    if (password !== confirm) {
      setError('两次输入的密码不一样')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await resetPassword(token, password)
      setDone(true)
      // 后端已经把这个账号的所有会话都踢了；本地要是还显示登着，同步一下
      if (user) await logout()
    } catch (err) {
      setError(err instanceof Error ? err.message : '重置失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="py-4 sm:py-8">
      <h2 className="mb-8 text-sm text-sumi">设置新密码</h2>

      {done ? (
        <p className="text-sm leading-relaxed text-sumi">
          密码改好了，所有设备都已退出登录。
          <Link to="/login" className="ml-2 text-ai hover:underline">
            去登录
          </Link>
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="新密码" hint="至少 8 位">
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              autoFocus
            />
          </Field>
          <Field label="再输一遍">
            <PasswordInput
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          {error && <p className="text-sm text-shu">{error}</p>}
          <SubmitButton busy={submitting}>确认</SubmitButton>
        </form>
      )}
    </div>
  )
}
