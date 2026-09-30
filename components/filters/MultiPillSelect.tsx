'use client'
import React, { useState, useRef, useEffect } from 'react'

export const PILL: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 5,
  padding: '4px 10px', borderRadius: 20, fontSize: 12,
  cursor: 'pointer', outline: 'none', border: '1px solid var(--border)',
  background: 'var(--surface-subtle)', color: 'var(--text-secondary)',
  fontFamily: 'inherit', whiteSpace: 'nowrap' as const,
}
export const PILL_ACTIVE: React.CSSProperties = {
  ...PILL, border: '1px solid var(--brand)',
  background: 'rgba(13,148,136,0.08)', color: 'var(--brand)', fontWeight: 600,
}

interface Props {
  values:      string[]
  onChange:    (v: string[]) => void
  placeholder: string
  options:     { value: string; label: string }[]
}

export function MultiPillSelect({ values, onChange, placeholder, options }: Props) {
  const [open, setOpen]           = useState(false)
  const [alignRight, setAlignRight] = useState(false)
  const ref                       = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const active = values.length > 0
  const label  = !active
    ? placeholder
    : values.length === 1
      ? (options.find(o => o.value === values[0])?.label ?? values[0])
      : `${values.length} selected`

  function toggle(v: string) {
    onChange(values.includes(v) ? values.filter(x => x !== v) : [...values, v])
  }

  // ── Select all ────────────────────────────────────────────────────────────
  // Sets every option rather than clearing the filter. The two look identical
  // on a full list and are not: the reason to want this is "everyone except
  // two", which needs all-selected-then-uncheck. Clearing would leave nothing
  // to uncheck.
  //
  // Only counts options that exist now, so a list that grows (more members
  // joining, say) does not leave a stale "all" ticked.
  const allSelected  = options.length > 0 && options.every(o => values.includes(o.value))
  const someSelected = values.length > 0 && !allSelected

  function toggleAll() {
    // Deselecting everything goes back to [], which every caller reads as
    // "no filter" — the same state the × button produces. Leaving an empty
    // array of explicit selections would filter everything out instead.
    onChange(allSelected ? [] : options.map(o => o.value))
  }

  // A checkbox cannot express "some" through props; it has to be set on the
  // node. Without it, a partial selection shows an unticked box, which reads
  // as "nothing selected" while the pill says otherwise.
  const allRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = someSelected
  }, [someSelected, open])

  function handleOpen() {
    if (!open && ref.current) {
      const r = ref.current.getBoundingClientRect()
      setAlignRight(r.left + 180 > window.innerWidth - 8)
    }
    setOpen(o => !o)
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button type="button" onClick={handleOpen}
        style={{ ...(active ? PILL_ACTIVE : PILL), paddingRight: active ? 28 : 22 }}>
        {label}
        <svg viewBox="0 0 10 6" fill="none" style={{ width: 8, height: 8, flexShrink: 0, opacity: 0.6 }}>
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
      </button>

      {active && (
        <button type="button" onClick={e => { e.stopPropagation(); onChange([]) }}
          style={{
            position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
            width: 14, height: 14, borderRadius: '50%', border: 'none',
            background: 'var(--brand)', color: '#fff', fontSize: 9, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', lineHeight: 1, padding: 0,
          }}
          title="Clear">×</button>
      )}

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 5px)',
          ...(alignRight ? { right: 0 } : { left: 0 }),
          zIndex: 1100,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 10, boxShadow: '0 8px 28px rgba(0,0,0,0.14)',
          minWidth: 168, maxHeight: 240, overflowY: 'auto', padding: '4px 0',
        }}>
          {/* Worth the row only when there is more than one thing to select. */}
          {options.length > 1 && (
            <>
              <label
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 12px', cursor: 'pointer',
                  background: allSelected ? 'rgba(13,148,136,0.06)' : 'transparent',
                }}
                onMouseEnter={e => { if (!allSelected) (e.currentTarget as HTMLElement).style.background = 'var(--surface-subtle)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = allSelected ? 'rgba(13,148,136,0.06)' : 'transparent' }}>
                <input ref={allRef} type="checkbox" checked={allSelected} onChange={toggleAll}
                  style={{ accentColor: 'var(--brand)', width: 13, height: 13, flexShrink: 0, cursor: 'pointer' }}/>
                <span style={{ fontSize: 12, fontWeight: 600, color: allSelected ? 'var(--brand)' : 'var(--text-secondary)' }}>
                  {allSelected ? 'Deselect all' : 'Select all'}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
                  {options.length}
                </span>
              </label>
              <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }}/>
            </>
          )}

          {options.map(o => {
            const checked = values.includes(o.value)
            return (
              <label key={o.value}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 12px', cursor: 'pointer',
                  background: checked ? 'rgba(13,148,136,0.06)' : 'transparent',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (!checked) (e.currentTarget as HTMLElement).style.background = 'var(--surface-subtle)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = checked ? 'rgba(13,148,136,0.06)' : 'transparent' }}>
                <input type="checkbox" checked={checked} onChange={() => toggle(o.value)}
                  style={{ accentColor: 'var(--brand)', width: 13, height: 13, flexShrink: 0, cursor: 'pointer' }}/>
                <span style={{ fontSize: 12, color: checked ? 'var(--brand)' : 'var(--text-primary)', fontWeight: checked ? 600 : 400 }}>
                  {o.label}
                </span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
