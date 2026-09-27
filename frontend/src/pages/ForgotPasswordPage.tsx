import { useState } from 'react'
import { Link } from 'react-router-dom'
import { requestPasswordReset } from '../api'
import { Field, SubmitButton, TextInput } from '../components/AuthFields'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    if (email.trim() === '') {
      setError('填一下邮箱')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await requestPasswordReset(email.trim())
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="py-4 sm:py-8">
      <h2 className="mb-8 text-sm text-sumi">找回密码</h2>

      {sent ? (
        // 不管这个邮箱在不在都这么说 —— 否则这里就能拿来探别人有没有注册过
        <p className="text-sm leading-relaxed text-sumi">
          如果 <span className="text-ai">{email.trim()}</span>{' '}
          绑定过言葉账号，重置链接已经发过去了，30 分钟内有效。没收到的话看看垃圾邮件。
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="绑定的邮箱">
            <TextInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
            />
          </Field>
          {error && <p className="text-sm text-shu">{error}</p>}
          <SubmitButton busy={submitting}>发送重置链接</SubmitButton>
        </form>
      )}

      <p className="mt-8 text-xs leading-relaxed text-hai">
        没绑过邮箱的账号没法这样找回。
        <Link to="/login" className="ml-2 transition hover:text-sumi">
          回登录
        </Link>
      </p>
    </div>
  )
}
