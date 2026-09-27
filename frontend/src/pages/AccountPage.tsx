import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  GITHUB_LINK_URL,
  changePassword,
  fetchAccount,
  fetchAuthFeatures,
  fetchSessions,
  removeEmail,
  requestEmailChange,
  revokeOtherSessions,
  revokeSession,
  unlinkGithub,
} from '../api'
import type { Account, AuthFeatures, LoginSession } from '../api'
import { Field, PasswordInput, SubmitButton, TextInput } from '../components/AuthFields'

/** 绑定 GitHub 是整页跳走再跳回来的，结果放在 ?github= 上带回来。 */
const GITHUB_RESULT: Record<string, { text: string; ok: boolean }> = {
  linked: { text: 'GitHub 绑好了', ok: true },
  taken: { text: '这个 GitHub 账号已经绑定了别的用户，或者你已经绑了另一个', ok: false },
  failed: { text: 'GitHub 授权没有完成，可以再试一次', ok: false },
}

export default function AccountPage() {
  const [params] = useSearchParams()
  const [account, setAccount] = useState<Account | null>(null)
  const [features, setFeatures] = useState<AuthFeatures>({ email: false, github: false })
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setAccount(await fetchAccount())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    }
  }

  useEffect(() => {
    load()
    fetchAuthFeatures()
      .then(setFeatures)
      .catch(() => {})
  }, [])

  if (!account) {
    return <p className="text-sm text-hai">{error ?? '加载中…'}</p>
  }

  const githubResult = GITHUB_RESULT[params.get('github') ?? '']

  return (
    <div className="space-y-12">
      <div>
        <p className="font-mincho text-2xl text-sumi">{account.username}</p>
        <p className="mt-1 text-xs tracking-wider text-hai">账号</p>
      </div>

      <PasswordSection account={account} onChanged={load} />

      {(features.email || account.email) && (
        <EmailSection account={account} enabled={features.email} onChanged={load} />
      )}

      {(features.github || account.githubLogin) && (
        <GithubSection account={account} result={githubResult} onChanged={load} />
      )}

      <SessionsSection />
    </div>
  )
}

// ---- 密码 -----------------------------------------------------------------

function PasswordSection({ account, onChanged }: { account: Account; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    if (account.hasPassword && current === '') {
      setError('要先填当前密码')
      return
    }
    if (next.length < 8) {
      setError('新密码至少 8 位')
      return
    }
    if (next !== confirm) {
      setError('两次输入的新密码不一样')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await changePassword(account.hasPassword ? current : null, next)
      setOpen(false)
      setCurrent('')
      setNext('')
      setConfirm('')
      setNotice(account.hasPassword ? '密码已修改，其他设备都已退出登录' : '密码设好了')
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : '修改失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section
      title="密码"
      status={account.hasPassword ? '已设置' : '还没有密码，目前只能用 GitHub 登录'}
      action={
        <ToggleButton open={open} onClick={() => setOpen(!open)}>
          {account.hasPassword ? '修改' : '设置密码'}
        </ToggleButton>
      }
      notice={notice}
    >
      {open && (
        <form onSubmit={handleSubmit} className="mt-6 max-w-sm space-y-5">
          {account.hasPassword && (
            <Field label="当前密码">
              <PasswordInput
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                autoComplete="current-password"
              />
            </Field>
          )}
          <Field label="新密码" hint="至少 8 位">
            <PasswordInput
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
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
          <SubmitButton busy={busy}>确认</SubmitButton>
        </form>
      )}
    </Section>
  )
}

// ---- 邮箱 -----------------------------------------------------------------

function EmailSection({
  account,
  enabled,
  onChanged,
}: {
  account: Account
  enabled: boolean
  onChanged: () => void
}) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    if (email.trim() === '') {
      setError('填一下邮箱')
      return
    }
    if (account.hasPassword && password === '') {
      setError('换绑邮箱要先验证当前密码')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await requestEmailChange(email.trim(), account.hasPassword ? password : null)
      setOpen(false)
      setPassword('')
      setNotice(`验证邮件已发到 ${email.trim()}，点里面的链接才算绑上（24 小时内有效）`)
      setEmail('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送失败')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove() {
    if (!window.confirm('解绑之后，忘了密码就没法自己找回了。确定吗？')) return
    try {
      await removeEmail()
      setNotice(null)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : '解绑失败')
    }
  }

  return (
    <Section
      title="邮箱"
      status={account.email ?? '未绑定 —— 绑了才能在忘记密码时找回'}
      action={
        <span className="flex gap-4">
          {enabled && (
            <ToggleButton open={open} onClick={() => setOpen(!open)}>
              {account.email ? '更换' : '绑定'}
            </ToggleButton>
          )}
          {account.email && <DangerButton onClick={handleRemove}>解绑</DangerButton>}
        </span>
      }
      notice={notice}
      error={open ? null : error}
    >
      {open && (
        <form onSubmit={handleSubmit} className="mt-6 max-w-sm space-y-5">
          <Field label="邮箱">
            <TextInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </Field>
          {account.hasPassword && (
            <Field label="当前密码">
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </Field>
          )}
          {error && <p className="text-sm text-shu">{error}</p>}
          <SubmitButton busy={busy}>发送验证邮件</SubmitButton>
        </form>
      )}
    </Section>
  )
}

// ---- GitHub ---------------------------------------------------------------

function GithubSection({
  account,
  result,
  onChanged,
}: {
  account: Account
  result?: { text: string; ok: boolean }
  onChanged: () => void
}) {
  const [error, setError] = useState<string | null>(null)

  async function handleUnlink() {
    if (!window.confirm('解绑之后就不能用这个 GitHub 账号登录了。确定吗？')) return
    try {
      await unlinkGithub()
      setError(null)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : '解绑失败')
    }
  }

  return (
    <Section
      title="GitHub"
      status={account.githubLogin ? `已绑定 @${account.githubLogin}` : '未绑定'}
      action={
        account.githubLogin ? (
          <DangerButton onClick={handleUnlink}>解绑</DangerButton>
        ) : (
          // 整页跳转：先到后端记一笔"这次是绑定"，再去 GitHub 授权
          <a href={GITHUB_LINK_URL} className="text-xs text-ai transition hover:underline">
            绑定
          </a>
        )
      }
      notice={result?.ok ? result.text : null}
      error={error ?? (result && !result.ok ? result.text : null)}
    />
  )
}

// ---- 登录设备 ---------------------------------------------------------------

function SessionsSection() {
  const [sessions, setSessions] = useState<LoginSession[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setSessions(await fetchSessions())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleRevoke(id: string) {
    try {
      await revokeSession(id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败')
    }
  }

  async function handleRevokeOthers() {
    try {
      await revokeOtherSessions()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败')
    }
  }

  const others = sessions?.filter((s) => !s.current).length ?? 0

  return (
    <Section
      title="登录设备"
      status={sessions ? `${sessions.length} 台设备登录着` : '加载中…'}
      action={
        others > 0 && <DangerButton onClick={handleRevokeOthers}>退出其他所有设备</DangerButton>
      }
      error={error}
    >
      {sessions && (
        <ul className="mt-4 divide-y divide-usu">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-baseline justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-sm text-sumi">
                  {describeUserAgent(s.userAgent)}
                  {s.current && <span className="ml-2 text-xs text-ai">当前设备</span>}
                </p>
                <p className="mt-0.5 truncate text-xs text-hai">
                  {s.ip ?? '未知 IP'} · 最近活动 {formatTime(s.lastAccessedAt)} · 登录于{' '}
                  {formatTime(s.createdAt)}
                </p>
              </div>
              {!s.current && <DangerButton onClick={() => handleRevoke(s.id)}>退出</DangerButton>}
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

/** 粗略认个浏览器和系统就够了，不值得为这个引一个 UA 解析库。 */
function describeUserAgent(ua: string | null): string {
  if (!ua) return '未知设备'
  const browser = /MicroMessenger/.test(ua)
    ? '微信'
    : /Edg\//.test(ua)
      ? 'Edge'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : '浏览器'
  const os = /iPhone|iPad/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Mac OS X/.test(ua)
        ? 'macOS'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Linux/.test(ua)
            ? 'Linux'
            : null
  return os ? `${browser} · ${os}` : browser
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ---- 零件 -----------------------------------------------------------------

function Section({
  title,
  status,
  action,
  notice,
  error,
  children,
}: {
  title: string
  status: string
  action?: React.ReactNode
  notice?: string | null
  error?: string | null
  children?: React.ReactNode
}) {
  return (
    <section className="border-t border-usu pt-6">
      <div className="flex items-baseline justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xs tracking-wider text-hai">{title}</h2>
          <p className="mt-1 text-sm break-all text-sumi">{status}</p>
        </div>
        <div className="shrink-0">{action}</div>
      </div>
      {notice && <p className="mt-3 text-sm text-ai">{notice}</p>}
      {error && <p className="mt-3 text-sm text-shu">{error}</p>}
      {children}
    </section>
  )
}

function ToggleButton({
  open,
  onClick,
  children,
}: {
  open: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button type="button" onClick={onClick} className="text-xs text-ai transition hover:underline">
      {open ? '取消' : children}
    </button>
  )
}

function DangerButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="text-xs text-hai transition hover:text-shu">
      {children}
    </button>
  )
}
