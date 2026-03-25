'use client'
import { useState }  from 'react'
import { useRouter } from 'next/navigation'
import Link          from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { toast }     from '@/store/appStore'

const COLORS   = ['#0d9488','#7c3aed','#dc2626','#ca8a04','#0891b2','#16a34a','#db2777','#ea580c','#64748b']
const STATUSES = ['active','on_hold','completed','cancelled']

export function ProjectEditForm({ project, clients, members }: { project: any; clients: any[]; members: any[] }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name:        project.name        ?? '',
    description: project.description ?? '',
    status:      project.status      ?? 'active',
    color:       project.color       ?? '#0d9488',
    client_id:   project.client_id   ?? '',
    owner_id:    project.owner_id    ?? '',
    start_date:  project.start_date  ?? '',
    due_date:    project.due_date    ?? '',
    budget:      project.budget      ?? '',
    hours_budget:project.hours_budget?? '',
  })

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Name required'); return }
    setSaving(true)
    const res = await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        client_id:    form.client_id    || null,
        owner_id:     form.owner_id     || null,
        start_date:   form.start_date   || null,
        due_date:     form.due_date     || null,
        budget:       form.budget       ? parseFloat(form.budget)       : null,
        hours_budget: form.hours_budget ? parseFloat(form.hours_budget) : null,
      }),
    })
    setSaving(false)
    if (res.ok) { toast.success('Project updated'); router.push(`/projects/${project.id}`) }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed') }
  }

  async function handleDelete() {
    if (!confirm(`Archive "${project.name}"? Tasks will remain.`)) return
    const res = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Project archived'); router.push('/projects') }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed') }
  }

  const Label = ({ children }: { children: React.ReactNode }) => (
    <label style={{ fontSize: 12, fontWeight: 600, color:'var(--text-secondary)', display: 'block', marginBottom: 5 }}>{children}</label>
  )
  const Input = ({ k, type = 'text', placeholder = '' }: { k: string; type?: string; placeholder?: string }) => (
    <input type={type} value={(form as any)[k]} onChange={e => set(k, e.target.value)} placeholder={placeholder}
      style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
      onFocus={e => e.target.style.borderColor = '#0d9488'}
      onBlur={e  => e.target.style.borderColor = '#e2e8f0'}/>
  )

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24, background:'var(--surface-subtle)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Link href={`/projects/${project.id}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color:'var(--text-muted)', marginBottom: 20, textDecoration: 'none' }}>
          <ArrowLeft style={{ width: 14, height: 14 }}/> Back to project
        </Link>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Edit project</h1>
          <button onClick={handleDelete}
            style={{ fontSize: 13, color: '#dc2626', background: 'none', border: '1px solid #fecaca', padding: '6px 14px', borderRadius: 7, cursor: 'pointer' }}>
            Archive project
          </button>
        </div>

        <form onSubmit={save}>
          <div className="card-elevated" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Color */}
            <div>
              <Label>Colour</Label>
              <div style={{ display: 'flex', gap: 8 }}>
                {COLORS.map(c => (
                  <button type="button" key={c} onClick={() => set('color', c)}
                    style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: c === form.color ? '3px solid #0f172a' : '2px solid transparent', cursor: 'pointer' }}/>
                ))}
              </div>
            </div>

            <div><Label>Project name *</Label><Input k="name"/></div>
            <div><Label>Description</Label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2}
                style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}/>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <Label>Status</Label>
                <select value={form.status} onChange={e => set('status', e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', background:'var(--surface)' }}>
                  {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ').replace(/^\w/, c => c.toUpperCase())}</option>)}
                </select>
              </div>
              <div>
                <Label>Client</Label>
                <select value={form.client_id} onChange={e => set('client_id', e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', background:'var(--surface)' }}>
                  <option value="">No client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Project lead (approver)</Label>
                <select value={form.owner_id} onChange={e => set('owner_id', e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', background:'var(--surface)' }}>
                  <option value="">No lead assigned</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div><Label>Start date</Label><Input k="start_date" type="date"/></div>
              <div><Label>Due date</Label><Input k="due_date" type="date"/></div>
              <div><Label>Budget (₹)</Label><Input k="budget" type="number" placeholder="e.g. 50000"/></div>
              <div><Label>Hours budget</Label><Input k="hours_budget" type="number" placeholder="e.g. 120"/></div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
              <Link href={`/projects/${project.id}`} style={{ padding: '9px 18px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 13, fontWeight: 500, textDecoration: 'none', color:'var(--text-secondary)' }}>
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
