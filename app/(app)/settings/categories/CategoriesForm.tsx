'use client'
import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { toast } from '@/store/appStore'

export function CategoriesForm({ orgId, initial }: { orgId: string; initial: string[] }) {
  const [cats,    setCats]    = useState<string[]>(initial)
  const [newCat,  setNewCat]  = useState('')
  const [saving,  setSaving]  = useState(false)

  function add() {
    const v = newCat.trim()
    if (!v || cats.includes(v)) return
    setCats(p => [...p, v]); setNewCat('')
  }

  function remove(cat: string) { setCats(p => p.filter(c => c !== cat)) }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/categories', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, client_categories: cats }),
      })
      if (res.ok) toast.success('Categories saved ✓')
      else toast.error('Failed to save')
    } finally { setSaving(false) }
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {cats.map(cat => (
          <span key={cat} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 99,
            background: 'var(--brand-light)', border: '1px solid var(--brand-border)',
            fontSize: 13, fontWeight: 500, color: 'var(--brand)',
          }}>
            {cat}
            <button onClick={() => remove(cat)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--brand)', display: 'flex', padding: 0, opacity: 0.7,
            }}>
              <X style={{ width: 12, height: 12 }}/>
            </button>
          </span>
        ))}
        {cats.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            No categories yet — add one below
          </p>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input value={newCat} onChange={e => setNewCat(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="Add a category… (press Enter)"
          style={{ flex: 1, padding: '8px 12px', borderRadius: 8,
            border: '1.5px solid var(--border)', outline: 'none',
            fontSize: 13, background: 'var(--surface)', color: 'var(--text-primary)',
            fontFamily: 'inherit' }}
          onFocus={e => e.target.style.borderColor = 'var(--brand)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}/>
        <button onClick={add} style={{
          padding: '8px 16px', borderRadius: 8,
          background: 'var(--brand)', color: '#fff', border: 'none',
          fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Plus style={{ width: 14, height: 14 }}/> Add
        </button>
      </div>

      <button onClick={save} disabled={saving}
        style={{ padding: '10px 24px', borderRadius: 8,
          background: 'var(--brand)', color: '#fff', border: 'none',
          fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.7 : 1, fontFamily: 'inherit' }}>
        {saving ? 'Saving…' : 'Save categories'}
      </button>
    </div>
  )
}
