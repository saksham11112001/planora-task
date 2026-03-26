'use client'
import type { CustomFieldDef } from '@/components/tasks/CustomFieldsPanel'
import { Hash, Calendar, AlignLeft } from 'lucide-react'

interface Props {
  defs:    CustomFieldDef[]
  values:  Record<string, any>
  onChange: (key: string, val: any) => void
}

export function InlineCustomFields({ defs, values, onChange }: Props) {
  if (!defs || defs.length === 0) return null

  return (
    <>
      {defs.map(field => {
        const val = values[field.key] ?? ''
        return (
          <label key={field.key} style={{ display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 20,
            border: '1px solid var(--border)', background: 'var(--surface-subtle)',
            cursor: 'pointer', minWidth: 0 }}>
            {field.type === 'date'
              ? <Calendar style={{ width: 11, height: 11, color: 'var(--text-muted)', flexShrink: 0 }}/>
              : field.type === 'textarea'
              ? <AlignLeft style={{ width: 11, height: 11, color: 'var(--text-muted)', flexShrink: 0 }}/>
              : <Hash style={{ width: 11, height: 11, color: 'var(--text-muted)', flexShrink: 0 }}/>
            }
            {field.type === 'textarea' || field.type === 'text' || field.type === 'number' ? (
              <input
                type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                value={val}
                onChange={e => onChange(field.key, e.target.value)}
                placeholder={field.placeholder ?? field.label}
                style={{ fontSize: 12, border: 'none', outline: 'none',
                  background: 'transparent', color: 'var(--text-primary)',
                  width: val ? 'auto' : Math.min(field.label.length * 7 + 20, 140),
                  minWidth: 60, fontFamily: 'inherit' }}
              />
            ) : field.type === 'date' ? (
              <input
                type="date"
                value={val}
                onChange={e => onChange(field.key, e.target.value)}
                style={{ fontSize: 12, border: 'none', outline: 'none',
                  background: 'transparent', color: val ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontFamily: 'inherit', colorScheme: 'light dark' }}
              />
            ) : field.type === 'select' ? (
              <select value={val} onChange={e => onChange(field.key, e.target.value)}
                style={{ fontSize: 12, border: 'none', outline: 'none',
                  background: 'transparent', color: 'var(--text-secondary)',
                  cursor: 'pointer', appearance: 'none', fontFamily: 'inherit' }}>
                <option value="">{field.label}…</option>
                {(field.options ?? []).map((o: string) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : null}
          </label>
        )
      })}
    </>
  )
}
