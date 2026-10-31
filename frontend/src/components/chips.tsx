/** 选择条（卡包、文章集、真题集）共用的几个小件。 */

export function InlineForm({
  value,
  onChange,
  placeholder,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  submitLabel: string
  onSubmit: () => void
  onCancel: () => void
}) {
  return (
    <div className="mt-3 flex items-center gap-2">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit()
          if (e.key === 'Escape') onCancel()
        }}
        placeholder={placeholder}
        autoFocus
        className="border-b border-usu bg-transparent pb-1 text-sm focus:border-ai focus:outline-none"
      />
      <button
        onClick={onSubmit}
        disabled={value.trim() === ''}
        className="rounded-sm bg-ai px-3 py-1 text-xs text-washi transition hover:opacity-85 disabled:opacity-30"
      >
        {submitLabel}
      </button>
      <button onClick={onCancel} className="text-xs text-hai transition hover:text-sumi">
        取消
      </button>
    </div>
  )
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  // 和顶上主导航同一套样子：文字 + 下划线，不再是一排方框
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? 'border-b border-sumi pb-0.5 text-sm text-sumi'
          : 'border-b border-transparent pb-0.5 text-sm text-hai transition hover:text-sumi'
      }
    >
      {children}
    </button>
  )
}

export function Count({ children }: { children: React.ReactNode }) {
  return <span className="ml-0.5 text-xs tabular-nums opacity-60">{children}</span>
}
