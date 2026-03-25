'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from '@/store/appStore'

const COLORS = ['#0d9488','#7c3aed','#dc2626','#ca8a04','#16a34a','#0891b2','#db2777','#ea580c','#4f46e5','#374151']

export function NewProjectForm({ clients, members }: {
  clients: { id: string; name: string; color: string }[]
  members: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [saving,     setSaving]     = useState(false)
  const [name,       setName]       = useState('')
  const [description,setDescription]= useState('')
  const [color,      setColor]      = useState('#0d9488')
  const searchParams = useSearchParams()
  const [clientId,   setClientId]   = useState(searchParams.get('client') ?? '')
  const [ownerId,    setOwnerId]    = useState('')
  const [dueDate,    setDueDate]    = useState('')
  const [budget,     setBudget]     = useState('')
  const [hoursBudget,setHoursBudget]= useState('')
  const [error,      setError]      = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Project name is required'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description || null, color, client_id: clientId || null, owner_id: ownerId || null, due_date: dueDate || null, budget: budget ? parseFloat(budget) : null, hours_budget: hoursBudget ? parseFloat(hoursBudget) : null }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      toast.success('Project created!')
      router.push(`/projects/${data.data.id}`)
    } catch { setError('Network error') } finally { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-5">
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Project name *</label>
        <input value={name} onChange={e => setName(e.target.value)} className="input" placeholder="e.g. Website redesign"/>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="input resize-none" placeholder="What is this project about?"/>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Project colour</label>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map(c => (
            <button key={c} type="button" onClick={() => setColor(c)}
              className="h-7 w-7 rounded-full transition-transform hover:scale-110 flex items-center justify-center"
              style={{ background: c }}>
              {color === c && <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3"><path d="M13 4L6.5 11 3 7.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Client</label>
          <select value={clientId} onChange={e => setClientId(e.target.value)} className="input">
            <option value="">No client</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Project owner</label>
          <select value={ownerId} onChange={e => setOwnerId(e.target.value)} className="input">
            <option value="">Select owner</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Due date</label>
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="input"/>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Budget (₹)</label>
          <input type="number" value={budget} onChange={e => setBudget(e.target.value)} className="input" placeholder="0"/>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Hours budget</label>
          <input type="number" value={hoursBudget} onChange={e => setHoursBudget(e.target.value)} className="input" placeholder="0"/>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={saving} className="btn btn-brand flex-1">
          {saving ? 'Creating...' : 'Create project'}
        </button>
        <button type="button" onClick={() => router.back()} className="btn btn-outline">Cancel</button>
      </div>
    </form>
  )
}
