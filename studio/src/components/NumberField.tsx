import { useEffect, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'

interface Props {
  label: string
  value: number
  unit?: string
  min?: number
  max?: number
  step?: number
  sanitize?: (value: number) => number
  onCommit: (value: number) => void
  onReset: () => void
  resetTitle?: string
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

/**
 * Typed number box with a local draft: only finite, clamped values reach the
 * layer, on blur or Enter. Escape restores the live value.
 */
export default function NumberField({ label, value, unit, min, max, step = 1, sanitize, onCommit, onReset, resetTitle }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const shown = formatNumber(value)
  const [draft, setDraft] = useState(shown)

  useEffect(() => {
    if (document.activeElement !== inputRef.current) setDraft(shown)
  }, [shown])

  function commit() {
    const text = draft.trim()
    if (!text) { setDraft(shown); return }
    let next = Number(text)
    if (!Number.isFinite(next)) { setDraft(shown); return }
    if (sanitize) next = sanitize(next)
    if (min !== undefined) next = Math.max(min, next)
    if (max !== undefined) next = Math.min(max, next)
    if (draft === shown) { setDraft(shown); return }
    onCommit(next)
    setDraft(formatNumber(next))
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 44, fontSize: 11, color: 'var(--text-mid)', flexShrink: 0 }}>{label}</span>
      <input
        ref={inputRef}
        type="number"
        step={step}
        value={draft}
        onChange={event => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commit()
            inputRef.current?.blur()
          } else if (event.key === 'Escape') {
            event.stopPropagation()
            setDraft(shown)
            inputRef.current?.blur()
          }
        }}
        style={{ flex: 1, minWidth: 0, padding: '4px 6px', fontSize: 11, textAlign: 'right' }}
      />
      <span style={{ width: 14, fontSize: 10, color: 'var(--text-lo)', flexShrink: 0 }}>{unit ?? ''}</span>
      <button className="btn-icon" title={resetTitle ?? `Reset ${label}`} aria-label={resetTitle ?? `Reset ${label}`}
        onClick={onReset} style={{ padding: 2, flexShrink: 0 }}>
        <RotateCcw size={11} />
      </button>
    </div>
  )
}
