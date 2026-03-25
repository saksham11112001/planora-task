'use client'
import { useState, useRef, useEffect, useCallback } from 'react'

interface Member { id: string; name: string }

interface Props {
  value:       string
  onChange:    (val: string) => void
  onKeyDown?:  (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  members:     Member[]
  placeholder?: string
  rows?:       number
  className?:  string
}

export function MentionTextarea({ value, onChange, onKeyDown, members, placeholder, rows = 2, className }: Props) {
  const ref          = useRef<HTMLTextAreaElement>(null)
  const [show,       setShow]       = useState(false)
  const [query,      setQuery]      = useState('')
  const [cursor,     setCursor]     = useState(0)
  const [selected,   setSelected]   = useState(0)
  const [dropPos,    setDropPos]    = useState({ top: 0, left: 0 })

  const filtered = members.filter(m =>
    m.name.toLowerCase().startsWith(query.toLowerCase())
  ).slice(0, 6)

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    const pos = e.target.selectionStart ?? 0
    onChange(val)
    setCursor(pos)

    // Detect @mention trigger
    const before = val.slice(0, pos)
    const match  = before.match(/@(\w*)$/)
    if (match) {
      setQuery(match[1])
      setShow(true)
      setSelected(0)
      // Position dropdown near cursor
      const ta = ref.current
      if (ta) {
        const lines = before.split('\n')
        const lineH = 20
        setDropPos({ top: lines.length * lineH + 4, left: 12 })
      }
    } else {
      setShow(false)
    }
  }

  function insertMention(member: Member) {
    const before    = value.slice(0, cursor)
    const after     = value.slice(cursor)
    const atStart   = before.lastIndexOf('@')
    const newVal    = before.slice(0, atStart) + `@${member.name} ` + after
    onChange(newVal)
    setShow(false)
    setTimeout(() => ref.current?.focus(), 0)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (show && filtered.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)); return }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); return }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertMention(filtered[selected])
        return
      }
      if (e.key === 'Escape') { setShow(false); return }
    }
    onKeyDown?.(e)
  }

  // Close on outside click
  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setShow(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <div style={{ position: 'relative' }}>
      <textarea
        ref={ref}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={className}
        style={{ resize: 'none' }}
      />
      {show && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: dropPos.top, left: dropPos.left,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          zIndex: 9999, minWidth: 180, overflow: 'hidden',
        }}>
          <div style={{ padding: '4px 10px 2px', fontSize: 10, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
            Mention
          </div>
          {filtered.map((m, i) => (
            <button key={m.id} type="button"
              onClick={() => insertMention(m)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '7px 12px', border: 'none', cursor: 'pointer', textAlign: 'left',
                background: i === selected ? 'var(--brand-light)' : 'transparent',
                transition: 'background 0.1s',
              }}
              onMouseEnter={() => setSelected(i)}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: 'var(--brand)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, flexShrink: 0,
              }}>{m.name[0]?.toUpperCase()}</div>
              <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: i === selected ? 600 : 400 }}>
                {m.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Render comment text with @mentions highlighted */
export function CommentText({ text, members }: { text: string; members: Member[] }) {
  const memberNames = members.map(m => m.name)
  const parts = text.split(/(@\w+(?:\s\w+)?)/g)
  return (
    <span>
      {parts.map((part, i) => {
        const name  = part.startsWith('@') ? part.slice(1) : null
        const match = name && memberNames.find(n => n.toLowerCase() === name.toLowerCase())
        if (match) {
          return (
            <span key={i} style={{
              background: 'var(--brand-light)', color: 'var(--brand)',
              fontWeight: 600, borderRadius: 4, padding: '0 3px',
            }}>
              {part}
            </span>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </span>
  )
}
