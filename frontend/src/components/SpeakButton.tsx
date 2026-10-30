import { useSyncExternalStore } from 'react'
import { playAudio, playingAudio, subscribeAudio } from '../card-audio'

/**
 * 小喇叭：点一下放 src 这段录音，正在放时亮起来。图标跟着字号走。
 * 只在卡片有这段录音时才放出来，没有就别显示。
 *
 * 按下时不抢焦点：答错要照着打一遍时，点完喇叭还能接着在输入框里打字。
 */
export default function SpeakButton({ src, label }: { src: string; label: string }) {
  const playing = useSyncExternalStore(subscribeAudio, playingAudio) === src

  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => playAudio(src)}
      aria-label={label}
      title={label}
      className={`ml-[0.4em] inline-flex align-middle transition hover:text-sumi ${
        playing ? 'text-ai' : 'text-hai/50'
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="h-[0.8em] w-[0.8em]"
      >
        <path d="M11 5 6 9H3v6h3l5 4z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        <path d="M18.5 5.5a9 9 0 0 1 0 13" />
      </svg>
    </button>
  )
}
