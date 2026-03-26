'use client'
import { useState, useEffect } from 'react'
import { Plus, X, Hash, Calendar, AlignLeft, List } from 'lucide-react'
import { toast } from '@/store/appStore'

export interface CustomFieldDef {
  key: string
  label: string
  type: 'text' | 'date' | 'number' | 'textarea' | 'select'
  options?: string[]  // for select type
  placeholder?: string
}

interface Props {
  taskId: string
  fieldDefs: CustomFieldDef[]
  existing?: Record<string, any>
  onSaved?: (fields: Record<string, any>) => void
  readOnly?: boolean
}

const TYPE_ICONS = {
  text: Hash, date: Calendar, number: Hash, textarea: AlignLeft, select: List,
}

export function CustomFieldsPanel({ taskId, fieldDefs, existing = {}, onSaved, readOnly }: Props) {
  const [values,  setValues]  = useState<Record<string, any>>(existing)
  const [saving,  setSaving]  = useState(false)
  const [changed, setChanged] = useState(false)

  if (!fieldDefs || fieldDefs.length === 0) return null

  function update(key: string, val: any) {
    setValues(p => ({ ...p, [key]: val }))
    setChanged(true)
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ custom_fields: values }),
      })
      if (res.ok) {
        toast.success('Custom fields saved ✓')
        setChanged(false)
        onSaved?.(values)
      } else {
        toast.error('Failed to save')
      }
    } finally { setSaving(false) }
  }

  return (
    <div style={{ marginTop: 16, borderTop: '1px solid var(--border-light)', paddingTop: 16 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
        Custom fields
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {fieldDefs.map(field => {
          const Icon = TYPE_ICONS[field.type] ?? Hash
          const val  = values[field.key] ?? ''
          return (
            <div key={field.key}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <Icon style={{ width: 10, height: 10 }}/>{field.label}
              </label>
              {field.type === 'textarea' ? (
                <textarea value={val} onChange={e => update(field.key, e.target.value)}
                  disabled={readOnly} rows={3}
                  placeholder={field.placeholder ?? `Enter ${field.label.toLowerCase()}…`}
                  style={{ width:'100%', padding:'7px 10px', borderRadius:7, border:'1.5px solid var(--border)',
                    outline:'none', fontSize:12, background:'var(--surface)', color:'var(--text-primary)',
                    fontFamily:'inherit', resize:'vertical', opacity: readOnly?0.6:1 }}
                  onFocus={e=>e.target.style.borderColor='var(--brand)'}
                  onBlur={e=>e.target.style.borderColor='var(--border)'}/>
              ) : field.type === 'select' ? (
                <select value={val} onChange={e => update(field.key, e.target.value)}
                  disabled={readOnly}
                  style={{ width:'100%', padding:'7px 10px', borderRadius:7, border:'1.5px solid var(--border)',
                    outline:'none', fontSize:12, background:'var(--surface)', color:'var(--text-primary)',
                    fontFamily:'inherit', opacity: readOnly?0.6:1 }}>
                  <option value="">Select {field.label}…</option>
                  {(field.options??[]).map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
                  value={val} onChange={e => update(field.key, e.target.value)}
                  disabled={readOnly}
                  placeholder={field.placeholder ?? `Enter ${field.label.toLowerCase()}…`}
                  style={{ width:'100%', padding:'7px 10px', borderRadius:7, border:'1.5px solid var(--border)',
                    outline:'none', fontSize:12, background:'var(--surface)', color:'var(--text-primary)',
                    fontFamily:'inherit', opacity: readOnly?0.6:1 }}
                  onFocus={e=>e.target.style.borderColor='var(--brand)'}
                  onBlur={e=>e.target.style.borderColor='var(--border)'}/>
              )}
            </div>
          )
        })}
      </div>
      {!readOnly && changed && (
        <button onClick={save} disabled={saving}
          style={{ marginTop:12, padding:'7px 16px', borderRadius:7, border:'none',
            background:'var(--brand)', color:'#fff', fontSize:12, fontWeight:600,
            cursor:'pointer', fontFamily:'inherit', opacity:saving?0.7:1 }}>
          {saving?'Saving…':'Save custom fields'}
        </button>
      )}
    </div>
  )
}
