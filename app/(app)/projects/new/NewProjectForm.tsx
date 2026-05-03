'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from '@/store/appStore'

// ── Project templates ────────────────────────────────────────────────────
interface TemplateTask {
  title: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  subtasks?: string[]
}
interface ProjectTemplate {
  icon: string
  industry: string
  desc: string
  color: string
  tasks: TemplateTask[]
}

const PROJECT_TEMPLATES: Record<string, ProjectTemplate> = {
  'Blank project': {
    icon: '⬜', industry: 'General', desc: 'Start from scratch — no pre-built tasks', color: '#64748b',
    tasks: [],
  },
}

const COLORS = ['#0d9488','#7c3aed','#dc2626','#ca8a04','#16a34a','#0891b2','#db2777','#ea580c','#4f46e5','#374151']

export function NewProjectForm({ clients: initialClients, members, orgTemplates = [] }: {
  clients: { id: string; name: string; color: string }[]
  members: { id: string; name: string }[]
  orgTemplates?: { id: string; name: string; template_tasks: any[] }[]
}) {
  const router = useRouter()
  const [saving,      setSaving]      = useState(false)
  const [name,        setName]        = useState('')
  const [description, setDescription] = useState('')
  const [color,       setColor]       = useState('#0d9488')
  const searchParams  = useSearchParams()
  const [clients,     setClients]     = useState(initialClients)
  const [clientId,    setClientId]    = useState(searchParams.get('client') ?? '')
  const [ownerId,     setOwnerId]     = useState('')
  const [dueDate,     setDueDate]     = useState('')
  const [budget,      setBudget]      = useState('')
  const [hoursBudget, setHoursBudget] = useState('')
  const [error,       setError]       = useState('')
  const [memberIds,    setMemberIds]    = useState<string[]>([])
  const [selectedTemplate,     setSelectedTemplate]     = useState<string | null>(null)
  const [templateTasksPreview, setTemplateTasksPreview] = useState<TemplateTask[]>([])
  const [saveAsTemplate,       setSaveAsTemplate]       = useState(false)
  const [loadingOrgTemplate,   setLoadingOrgTemplate]   = useState<string | null>(null)
  const [addingClient,         setAddingClient]         = useState(false)
  const [newClientName,        setNewClientName]        = useState('')
  const [addingClientLoading,  setAddingClientLoading]  = useState(false)

  async function handleOrgTemplateClick(tmpl: { id: string; name: string; template_tasks: any[] }) {
    const key = `org_${tmpl.id}`
    if (selectedTemplate === key) {
      setSelectedTemplate(null)
      setTemplateTasksPreview([])
      return
    }
    setSelectedTemplate(key)
    setLoadingOrgTemplate(tmpl.id)
    try {
      const res = await fetch(`/api/tasks?project_id=${tmpl.id}&limit=500`)
      if (res.ok) {
        const json = await res.json()
        const allTasks: any[] = json.data ?? json ?? []
        const parents = allTasks.filter((t: any) => !t.parent_task_id)
        const children = allTasks.filter((t: any) => !!t.parent_task_id)
        const tasks: TemplateTask[] = parents.map((p: any) => ({
          title: p.title,
          priority: p.priority ?? 'medium',
          subtasks: children.filter((c: any) => c.parent_task_id === p.id).map((c: any) => c.title),
        }))
        // Fall back to stored template_tasks if live fetch returns nothing
        setTemplateTasksPreview(tasks.length > 0 ? tasks : (tmpl.template_tasks ?? []))
      } else {
        setTemplateTasksPreview(tmpl.template_tasks ?? [])
      }
    } catch {
      setTemplateTasksPreview(tmpl.template_tasks ?? [])
    } finally {
      setLoadingOrgTemplate(null)
    }
    if (!name) setName(tmpl.name)
  }

  async function handleAddClient() {
    if (!newClientName.trim()) return
    setAddingClientLoading(true)
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newClientName.trim(), status: 'active' }),
      })
      const data = await res.json()
      if (res.ok && data.data?.id) {
        const newClient = { id: data.data.id, name: data.data.name, color: data.data.color ?? '#94a3b8' }
        setClients(prev => [...prev, newClient])
        setClientId(newClient.id)
        setAddingClient(false)
        setNewClientName('')
        toast.success('Client added!')
      }
    } catch {} finally { setAddingClientLoading(false) }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Project name is required'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(), description: description || null, color,
          client_id: clientId || null, owner_id: ownerId || null,
          due_date: dueDate || null,
          budget: budget ? parseFloat(budget) : null,
          hours_budget: hoursBudget ? parseFloat(hoursBudget) : null,
          template_tasks: templateTasksPreview.length > 0 ? templateTasksPreview : undefined,
          member_ids: memberIds.length > 0 ? memberIds : null,
          is_template: saveAsTemplate,
        }),
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

      {/* ── Template picker — org templates first, then blank ── */}
      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Start from a template</label>
        <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
          <div style={{ display: 'flex', gap: 10, minWidth: 'max-content' }}>
            {/* Org custom templates — shown first */}
            {orgTemplates.map(tmpl => {
              const isSelected = selectedTemplate === `org_${tmpl.id}`
              const isLoading = loadingOrgTemplate === tmpl.id
              return (
                <button key={tmpl.id} type="button"
                  onClick={() => handleOrgTemplateClick(tmpl)}
                  disabled={isLoading}
                  style={{
                    width: 154, flexShrink: 0, padding: '12px 14px', borderRadius: 12, textAlign: 'left',
                    border: isSelected ? '2px solid #0d9488' : '1.5px solid var(--border)',
                    background: isSelected ? 'rgba(13,148,136,0.12)' : 'var(--surface-subtle)',
                    cursor: isLoading ? 'wait' : 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                    opacity: isLoading ? 0.7 : 1,
                    boxShadow: isSelected ? '0 4px 14px rgba(13,148,136,0.2)' : 'none',
                  }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: isSelected ? '#0d9488' : 'var(--brand)', marginBottom: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isLoading
                      ? <span style={{ fontSize: 12, color: '#fff', fontWeight: 700 }}>…</span>
                      : <span style={{ fontSize: 16 }}>📁</span>
                    }
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#0d9488', marginBottom: 2 }}>ORG TEMPLATE</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: isSelected ? '#0d9488' : 'var(--text-primary)', marginBottom: 3, lineHeight: 1.3 }}>{tmpl.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {isLoading ? 'Loading…' : isSelected ? `${templateTasksPreview.length} tasks` : 'Click to load tasks'}
                  </div>
                </button>
              )
            })}
            {/* Separator if org templates exist */}
            {orgTemplates.length > 0 && (
              <div style={{ width: 1, background: 'var(--border)', flexShrink: 0, alignSelf: 'stretch', margin: '0 4px' }} />
            )}
            {/* Blank project */}
            {Object.entries(PROJECT_TEMPLATES).map(([tName, tData]) => (
              <button
                key={tName}
                type="button"
                onClick={() => {
                  const same = selectedTemplate === tName
                  setSelectedTemplate(same ? null : tName)
                  setTemplateTasksPreview(same ? [] : tData.tasks)
                }}
                style={{
                  width: 154, flexShrink: 0, padding: '12px 14px', borderRadius: 12, textAlign: 'left',
                  border: selectedTemplate === tName ? `2px solid ${tData.color}` : '1.5px solid var(--border)',
                  background: selectedTemplate === tName ? `${tData.color}18` : 'var(--surface-subtle)',
                  cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                  boxShadow: selectedTemplate === tName ? `0 4px 14px ${tData.color}25` : 'none',
                }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: tData.color, marginBottom: 6, flexShrink: 0 }}/>
                <div style={{ fontSize: 11, fontWeight: 700, color: selectedTemplate === tName ? tData.color : 'var(--text-primary)', marginBottom: 3, lineHeight: 1.3 }}>{tName}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Start blank</div>
              </button>
            ))}
          </div>
        </div>
        {selectedTemplate && selectedTemplate !== 'Blank project' && templateTasksPreview.length > 0 && (
          <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 10, background: 'rgba(13,148,136,0.08)', border: '1px solid rgba(13,148,136,0.2)' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)', marginBottom: 6 }}>
              Will auto-create {templateTasksPreview.length} tasks · {templateTasksPreview.reduce((n, t) => n + (t.subtasks?.length ?? 0), 0)} subtasks
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {templateTasksPreview.slice(0, 6).map((t, i) => (
                <span key={i} style={{ fontSize: 10, background: 'var(--surface)', color: 'var(--text-primary)', padding: '2px 8px', borderRadius: 99, border: '1px solid rgba(13,148,136,0.2)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  {t.title}{t.subtasks?.length ? <span style={{ color: '#0d9488', fontWeight: 700 }}>+{t.subtasks.length}</span> : null}
                </span>
              ))}
              {templateTasksPreview.length > 6 && <span style={{ fontSize: 10, color: '#0d9488', fontWeight: 600 }}>+{templateTasksPreview.length - 6} more</span>}
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
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="input resize-none" placeholder="What is this project about?"/>
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
          {!addingClient ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <select value={clientId} onChange={e => setClientId(e.target.value)} className="input" style={{ flex: 1 }}>
                <option value="">No client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button type="button" onClick={() => setAddingClient(true)}
                style={{ padding: '0 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fafafa', cursor: 'pointer', fontSize: 13, color: '#0d9488', fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                + New
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 6 }}>
              <input autoFocus value={newClientName} onChange={e => setNewClientName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddClient() } if (e.key === 'Escape') { setAddingClient(false); setNewClientName('') } }}
                className="input" style={{ flex: 1 }} placeholder="New client name" />
              <button type="button" onClick={handleAddClient} disabled={addingClientLoading}
                style={{ padding: '0 12px', borderRadius: 8, border: 'none', background: '#0d9488', cursor: 'pointer', fontSize: 13, color: '#fff', fontWeight: 600, fontFamily: 'inherit' }}>
                {addingClientLoading ? '…' : 'Add'}
              </button>
              <button type="button" onClick={() => { setAddingClient(false); setNewClientName('') }}
                style={{ padding: '0 10px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fafafa', cursor: 'pointer', fontSize: 13, color: '#6b7280', fontFamily: 'inherit' }}>
                ✕
              </button>
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Project owner</label>
          <select value={ownerId} onChange={e => setOwnerId(e.target.value)} className="input">
            <option value="">Select owner</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>

      {/* Team members — who can see this project */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Visible to members
          <span className="ml-1.5 text-xs font-normal text-gray-400">(leave empty = whole org)</span>
        </label>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, padding:'10px 12px', border:'1px solid #e5e7eb', borderRadius:8, background:'#fafafa', minHeight:44 }}>
          {members.map(m => {
            const selected = memberIds.includes(m.id)
            return (
              <button key={m.id} type="button"
                onClick={() => setMemberIds(p => selected ? p.filter(id => id !== m.id) : [...p, m.id])}
                style={{
                  display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:20,
                  border: selected ? '1.5px solid #0d9488' : '1.5px solid #e5e7eb',
                  background: selected ? 'rgba(13,148,136,0.1)' : '#fff',
                  cursor:'pointer', fontSize:12, fontWeight: selected ? 600 : 400,
                  color: selected ? '#0d9488' : '#6b7280', transition:'all 0.12s', fontFamily:'inherit',
                }}>
                <div style={{ width:18, height:18, borderRadius:'50%', background:selected?'#0d9488':'#e5e7eb', display:'flex', alignItems:'center', justifyContent:'center', color:selected?'#fff':'#6b7280', fontSize:9, fontWeight:700, flexShrink:0 }}>
                  {m.name[0]?.toUpperCase()}
                </div>
                {m.name}
                {selected && <span style={{ fontSize:10 }}>✓</span>}
              </button>
            )
          })}
          {members.length === 0 && <span style={{ fontSize:12, color:'#9ca3af' }}>No team members yet</span>}
        </div>
        {memberIds.length > 0 && (
          <p style={{ fontSize:11, color:'#6b7280', marginTop:4 }}>
            {memberIds.length} member{memberIds.length > 1 ? 's' : ''} selected — only they (and admins/owners) will see this project
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Due date</label>
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="input"/>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Budget ($)</label>
          <input type="number" value={budget} onChange={e => setBudget(e.target.value)} className="input" placeholder="0"/>
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
        <input type="checkbox" checked={saveAsTemplate} onChange={e => setSaveAsTemplate(e.target.checked)}
          style={{ width: 15, height: 15, accentColor: '#0d9488' }} />
        Save this project as a reusable template for your organisation
      </label>

      <div style={{ display: 'flex', gap: 10 }}>
        <Link href="/projects"
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '10px 18px', borderRadius: 8, border: '1.5px solid #e2e8f0',
            fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', textDecoration: 'none',
            transition: 'border-color 0.15s, color 0.15s' }}
          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor='#0d9488'; el.style.color='#0d9488' }}
          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor='#e2e8f0'; el.style.color='var(--text-secondary)' }}>
          Cancel
        </Link>
        <button type="submit" disabled={saving}
          style={{ flex: 2 }}
          className="py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-60">
          {saving ? 'Creating…' : selectedTemplate && selectedTemplate !== 'Blank project' ? `Create project with ${templateTasksPreview.length} tasks →` : 'Create project'}
        </button>
      </div>
    </form>
  )
}