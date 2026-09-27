import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { verifyEmail } from '../api'
import { useAuth } from '../auth-context'

type State = 'pending' | 'ok' | 'failed'

export default function VerifyEmailPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const { user } = useAuth()

  const [state, setState] = useState<State>(token === '' ? 'failed' : 'pending')
  const [message, setMessage] = useState('链接不完整，请从邮件里重新点开')
  // 令牌只能用一次，而 StrictMode 下 effect 会跑两遍 —— 第二遍必然失败，把成功盖掉
  const sent = useRef(false)

  useEffect(() => {
    if (token === '' || sent.current) return
    sent.current = true
    verifyEmail(token)
      .then(() => setState('ok'))
      .catch((err) => {
        setMessage(err instanceof Error ? err.message : '验证失败')
        setState('failed')
      })
  }, [token])

  return (
    <div className="py-4 sm:py-8">
      <h2 className="mb-8 text-sm text-sumi">验证邮箱</h2>
      {state === 'pending' && <p className="text-sm text-hai">验证中…</p>}
      {state === 'ok' && (
        <p className="text-sm leading-relaxed text-sumi">
          邮箱绑好了，以后忘了密码可以用它找回。
          <Link to={user ? '/account' : '/login'} className="ml-2 text-ai hover:underline">
            {user ? '回账号页' : '去登录'}
          </Link>
        </p>
      )}
      {state === 'failed' && <p className="text-sm text-shu">{message}</p>}
    </div>
  )
}
