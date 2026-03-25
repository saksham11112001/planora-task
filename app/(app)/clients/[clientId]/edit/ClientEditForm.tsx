'use client'
import { useState }  from 'react'
import { useRouter } from 'next/navigation'
import Link          from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { toast }     from '@/store/appStore'

const COLORS = ['#0d9488','#7c3aed','#dc2626','#ca8a04','#0891b2','#16a34a','#db2777','#ea580c','#64748b']
const STATUSES = ['active','inactive','prospect']

export function ClientEditForm({ client }: { client: any }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name:     client.name     ?? '',
    email:    client.email    ?? '',
    phone:    client.phone    ?? '',
    company:  client.company  ?? '',
    website:  client.website  ?? '',
    industry: client.industry ?? '',
    notes:    client.notes    ?? '',
    status:   client.status   ?? 'active',
    color:    client.color    ?? '#0d9488',
  })

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Name required'); return }
    setSaving(true)
    const res = await fetch(`/api/clients/${client.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (res.ok) { toast.success('Client updated'); router.push(`/clients/${client.id}`) }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed') }
  }

  async function handleDelete() {
    if (!confirm(`Delete ${client.name}? This cannot be undone.`)) return
    const res = await fetch(`/api/clients/${client.id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Client deleted'); router.push('/clients') }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed') }
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24, background:'var(--surface-subtle)' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <Link href={`/clients/${client.id}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color:'var(--text-muted)', marginBottom: 20, textDecoration: 'none' }}>
          <ArrowLeft style={{ width: 14, height: 14 }}/> Back to client
        </Link>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Edit client</h1>
          <button onClick={handleDelete}
            style={{ fontSize: 13, color: '#dc2626', background: 'none', border: '1px solid #fecaca', padding: '6px 14px', borderRadius: 7, cursor: 'pointer' }}>
            Delete client
          </button>
        </div>

        <form onSubmit={save}>
          <div className="card-elevated" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Color picker */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color:'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Colour</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {COLORS.map(c => (
                  <button type="button" key={c} onClick={() => set('color', c)}
                    style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: c === form.color ? '3px solid #0f172a' : '2px solid transparent', cursor: 'pointer' }}/>
                ))}
              </div>
            </div>

            {[
              { k: 'name',     l: 'Client name *', type: 'text',  required: true },
              { k: 'company',  l: 'Company',        type: 'text' },
              { k: 'email',    l: 'Email',           type: 'email' },
              { k: 'phone',    l: 'Phone',           type: 'tel' },
              { k: 'website',  l: 'Website',         type: 'url' },
              { k: 'industry', l: 'Industry',        type: 'text' },
            ].map(({ k, l, type, required }) => (
              <div key={k}>
                <label style={{ fontSize: 12, fontWeight: 600, color:'var(--text-secondary)', display: 'block', marginBottom: 5 }}>{l}</label>
                <input type={type} value={(form as any)[k]} onChange={e => set(k, e.target.value)} required={required}
                  style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = '#0d9488'}
                  onBlur={e  => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>
            ))}

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color:'var(--text-secondary)', display: 'block', marginBottom: 5 }}>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', background:'var(--surface)' }}>
                {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color:'var(--text-secondary)', display: 'block', marginBottom: 5 }}>Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
                style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}/>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Link href={`/clients/${client.id}`} style={{ padding: '9px 18px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 13, fontWeight: 500, textDecoration: 'none', color:'var(--text-secondary)' }}>
                Cancel
              </Link>
              <button type="submit" disabled={saving}
                style={{ padding: '9px 20px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
