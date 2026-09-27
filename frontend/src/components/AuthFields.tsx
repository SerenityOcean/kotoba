import { useState } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'

/** 登录、找回密码、账号页共用的表单零件，长得和原来登录页上的一样。 */

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
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

const INPUT =
  'w-full border-b border-usu bg-transparent py-2 text-lg outline-none transition focus:border-sumi'

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={INPUT} />
}

/**
 * 密码框，右边带"显示/隐藏"。另外提示大写锁定 —— 密码框里看不见字，
 * 开着 Caps Lock 输错是登录失败最常见的原因之一。
 */
export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visible, setVisible] = useState(false)
  const [capsLock, setCapsLock] = useState(false)

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    setCapsLock(e.getModifierState('CapsLock'))
  }

  return (
    <div>
      <div className="relative">
        <input
          {...props}
          type={visible ? 'text' : 'password'}
          onKeyDown={onKey}
          onKeyUp={onKey}
          onBlur={() => setCapsLock(false)}
          className={`${INPUT} pr-12`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          // 别抢走 Tab 顺序：键盘用户从密码框直接跳到提交按钮
          tabIndex={-1}
          className="absolute right-0 bottom-2 text-xs text-hai transition hover:text-sumi"
        >
          {visible ? '隐藏' : '显示'}
        </button>
      </div>
      {capsLock && <p className="mt-1 text-xs text-shu">大写锁定已打开</p>}
    </div>
  )
}

export function SubmitButton({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="w-full rounded-sm bg-ai px-8 py-3 text-sm text-washi transition hover:opacity-85 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ai"
    >
      {busy ? '请稍候…' : children}
    </button>
  )
}
