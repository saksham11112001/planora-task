
const PROJECT_TEMPLATES: Record<string, { icon: string; desc: string; tasks: { title: string; priority: 'medium' | 'high' | 'low' }[] }> = {
  'Restaurant Consultancy': {
    icon: '🍽️', desc: 'Menu review, SOP setup, staff training, compliance audit',
    tasks: [
      { title: 'Initial site visit & assessment', priority: 'high' },
      { title: 'Menu engineering & costing', priority: 'high' },
      { title: 'SOP documentation', priority: 'medium' },
      { title: 'Staff training plan', priority: 'medium' },
      { title: 'FSSAI compliance audit', priority: 'high' },
      { title: 'Marketing & branding review', priority: 'low' },
      { title: 'Final recommendations report', priority: 'high' },
    ],
  },
  'Website Development': {
    icon: '🌐', desc: 'Discovery, design, build, QA, and launch',
    tasks: [
      { title: 'Requirements gathering & discovery', priority: 'high' },
      { title: 'Wireframes & UX design', priority: 'high' },
      { title: 'UI design (desktop + mobile)', priority: 'high' },
      { title: 'Frontend development', priority: 'medium' },
      { title: 'Backend / CMS setup', priority: 'medium' },
      { title: 'Content upload & SEO setup', priority: 'medium' },
      { title: 'QA testing & bug fixes', priority: 'high' },
      { title: 'Launch & handover', priority: 'high' },
    ],
  },
  'Audit Engagement': {
    icon: '📋', desc: 'Statutory audit planning through report issuance',
    tasks: [
      { title: 'Engagement letter & terms', priority: 'high' },
      { title: 'Preliminary assessment & risk analysis', priority: 'high' },
      { title: 'Audit plan preparation', priority: 'medium' },
      { title: 'Fieldwork — vouching & verification', priority: 'high' },
      { title: 'Internal control testing', priority: 'medium' },
      { title: 'Queries & management responses', priority: 'medium' },
      { title: 'Audit report drafting', priority: 'high' },
      { title: 'Partner review & sign-off', priority: 'high' },
    ],
  },
  'Marketing Campaign': {
    icon: '📣', desc: 'Strategy, content, execution, and reporting',
    tasks: [
      { title: 'Campaign brief & objectives', priority: 'high' },
      { title: 'Target audience research', priority: 'medium' },
      { title: 'Content calendar creation', priority: 'high' },
      { title: 'Creative assets (graphics, copy)', priority: 'high' },
      { title: 'Ad setup & targeting', priority: 'medium' },
      { title: 'Campaign launch', priority: 'high' },
      { title: 'Mid-campaign review & optimisation', priority: 'medium' },
      { title: 'Final report & learnings', priority: 'medium' },
    ],
  },
  'Event Management': {
    icon: '🎪', desc: 'Planning, logistics, execution, and post-event review',
    tasks: [
      { title: 'Event concept & brief', priority: 'high' },
      { title: 'Venue finalisation', priority: 'high' },
      { title: 'Vendor bookings (catering, AV, decor)', priority: 'high' },
      { title: 'Guest list & invitations', priority: 'medium' },
      { title: 'Run-of-show document', priority: 'medium' },
      { title: 'Day-of coordination', priority: 'high' },
      { title: 'Post-event feedback & report', priority: 'low' },
    ],
  },
  'Blank project': {
    icon: '⬜', desc: 'Start from scratch — no pre-built tasks',
    tasks: [],
  },
}

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
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [templateTasksPreview, setTemplateTasksPreview] = useState<{ title: string; priority: string }[]>([])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Project name is required'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description || null, color, client_id: clientId || null, owner_id: ownerId || null, due_date: dueDate || null, budget: budget ? parseFloat(budget) : null, hours_budget: hoursBudget ? parseFloat(hoursBudget) : null, template_tasks: templateTasksPreview.length > 0 ? templateTasksPreview : undefined }),
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

      {/* Template picker */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Start from a template</label>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:8 }}>
          {Object.entries(PROJECT_TEMPLATES).map(([tName, tData]) => (
            <button
              key={tName}
              type="button"
              onClick={() => {
                setSelectedTemplate(tName)
                setTemplateTasksPreview(tData.tasks)
                if (!name) setName(tName === 'Blank project' ? '' : tName)
              }}
              style={{
                padding:'12px', borderRadius:10, border: selectedTemplate === tName ? '2px solid var(--brand)' : '1px solid #e5e7eb',
                background: selectedTemplate === tName ? 'var(--brand-light)' : '#fafafa',
                cursor:'pointer', textAlign:'left', transition:'all 0.15s', fontFamily:'inherit',
              }}>
              <div style={{ fontSize:20, marginBottom:4 }}>{tData.icon}</div>
              <div style={{ fontSize:12, fontWeight:700, color: selectedTemplate === tName ? 'var(--brand)' : '#374151', marginBottom:2 }}>{tName}</div>
              <div style={{ fontSize:10, color:'#9ca3af', lineHeight:1.4 }}>{tData.desc}</div>
            </button>
          ))}
        </div>
        {templateTasksPreview.length > 0 && (
          <div style={{ marginTop:10, padding:'10px 14px', borderRadius:8, background:'#f0fdfa', border:'1px solid #99f6e4' }}>
            <p style={{ fontSize:11, fontWeight:700, color:'#0d9488', marginBottom:6 }}>
              {templateTasksPreview.length} tasks will be created automatically
            </p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
              {templateTasksPreview.slice(0,5).map((t,i) => (
                <span key={i} style={{ fontSize:10, background:'#fff', color:'#374151', padding:'2px 8px', borderRadius:99, border:'1px solid #ccfbf1' }}>{t.title}</span>
              ))}
              {templateTasksPreview.length > 5 && (
                <span style={{ fontSize:10, color:'#0d9488', fontWeight:600 }}>+{templateTasksPreview.length-5} more</span>
              )}
            </div>
          </div>
        )}
      </div>

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
