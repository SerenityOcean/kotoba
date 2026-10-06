import { useEffect, useRef, useState } from 'react'
import { PRESETS, previewPreset } from '../sound'
import type { SoundPreset } from '../sound'

/**
 * 选打字音。点一个就换上并试听一遍，所以挨个点过去就能比较；
 * 「关」在最下面。点外面或者按 Esc 收起。
 */
export default function SoundPicker({
  value,
  onChange,
}: {
  /** null = 关 */
  value: SoundPreset | null
  onChange: (preset: SoundPreset | null) => void
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const current = PRESETS.find((p) => p.id === value)

  return (
    <span ref={root} data-sound-picker className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
        className={`text-xs transition hover:text-sumi ${current ? 'text-hai' : 'text-hai/50'}`}
      >
        声音：{current ? current.name : '关'}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-56 border border-usu bg-washi py-1 shadow-[0_4px_24px_rgba(0,0,0,0.08)]">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onChange(p.id)
                previewPreset(p.id)
              }}
              aria-pressed={value === p.id}
              aria-label={`${p.name}：${p.hint}`}
              className={`block w-full px-3 py-2 text-left transition hover:bg-usu/40 ${
                value === p.id ? 'text-ai' : 'text-sumi'
              }`}
            >
              <span className="text-sm">{p.name}</span>
              <span className="mt-0.5 block text-xs text-hai">{p.hint}</span>
            </button>
          ))}
          <button
            onClick={() => {
              onChange(null)
              setOpen(false)
            }}
            aria-pressed={value === null}
            className={`block w-full border-t border-usu px-3 py-2 text-left text-sm transition hover:bg-usu/40 ${
              value === null ? 'text-ai' : 'text-hai'
            }`}
          >
            关
          </button>
        </div>
      )}
    </span>
  )
}
