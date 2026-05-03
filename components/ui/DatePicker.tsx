'use client'
import { Calendar } from 'lucide-react'

interface Props {
  value:        string
  onChange:     (v: string) => void
  placeholder?: string
}

function toDisplay(iso: string): string {
  if (!iso || iso.length !== 10) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function DatePicker({ value, onChange, placeholder = 'Pick date' }: Props) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', position: 'relative' }}>
      <Calendar style={{ width: 12, height: 12, color: value ? '#0d9488' : '#94a3b8', flexShrink: 0 }}/>
      <span style={{ fontSize: 12, color: value ? '#0f172a' : '#94a3b8', minWidth: 60 }}>
        {value ? toDisplay(value) : placeholder}
      </span>
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          position: 'absolute', inset: 0, opacity: 0,
          cursor: 'pointer', width: '100%', height: '100%',
        }}
      />
    </label>
  )
}
