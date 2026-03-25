'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/store/appStore'

const COLORS = ['#0d9488','#7c3aed','#dc2626','#ca8a04','#16a34a','#0891b2','#db2777','#4f46e5','#ea580c','#374151']

export function NewClientForm() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const [form,   setForm]   = useState({ name: '', email: '', phone: '', company: '', website: '', industry: '', notes: '', status: 'active', color: '#0d9488' })

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Client name is required'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/clients', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, name: form.name.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      toast.success('Client added!')
      router.push(`/clients/${data.data.id}`)
    } catch { setError('Network error') } finally { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-5">
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Client name *</label>
        <input value={form.name} onChange={e => set('name', e.target.value)} className="input" placeholder="Acme Corp"/></div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
          <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="input" placeholder="hello@acme.com"/></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
          <input value={form.phone} onChange={e => set('phone', e.target.value)} className="input" placeholder="+91 98765 43210"/></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Company</label>
          <input value={form.company} onChange={e => set('company', e.target.value)} className="input" placeholder="Parent company"/></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Website</label>
          <input value={form.website} onChange={e => set('website', e.target.value)} className="input" placeholder="https://acme.com"/></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
          <select value={form.status} onChange={e => set('status', e.target.value)} className="input">
            <option value="active">Active</option><option value="prospect">Prospect</option><option value="inactive">Inactive</option>
          </select></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Industry</label>
          <input value={form.industry} onChange={e => set('industry', e.target.value)} className="input" placeholder="e.g. Technology"/></div>
      </div>
      <div><label className="block text-sm font-medium text-gray-700 mb-2">Colour</label>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map(c => (
            <button key={c} type="button" onClick={() => set('color', c)}
              className="h-7 w-7 rounded-full hover:scale-110 transition-transform flex items-center justify-center" style={{ background: c }}>
              {form.color === c && <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3"><path d="M13 4L6.5 11 3 7.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </button>
          ))}
        </div>
      </div>
      <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} className="input resize-none" placeholder="Internal notes..."/></div>
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={saving} className="btn btn-brand flex-1">{saving ? 'Saving...' : 'Add client'}</button>
        <button type="button" onClick={() => router.back()} className="btn btn-outline">Cancel</button>
      </div>
    </form>
  )
}
