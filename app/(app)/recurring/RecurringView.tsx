'use client'
import { useState, useTransition, useEffect } from 'react'
import { useRouter }          from 'next/navigation'
import { RefreshCw, X, Pencil, Check } from 'lucide-react'
import { InlineRecurringTask } from '@/components/tasks/InlineRecurringTask'
import { fmtDate }             from '@/lib/utils/format'
import { toast }               from '@/store/appStore'
import { PriorityBadge, Avatar } from '@/components/ui/Badge'

const FREQ_LABELS: Record<string, string> = {
  daily: 'Daily', weekly: 'Weekly', bi_weekly: 'Every 2 weeks',
  monthly: 'Monthly', quarterly: 'Quarterly', annual: 'Annual',
}

interface Task {
  id: string; title: string; status: string; priority: string
  frequency: string | null; next_occurrence_date: string | null
  assignee_id: string | null; client_id: string | null
  assignee: { id: string; name: string } | null
  project:  { id: string; name: string; color: string } | null
  client:   { id: string; name: string; color: string } | null
}

interface Props {
  tasks:         Task[]
  members:       { id: string; name: string }[]
  projects:      { id: string; name: string; color: string }[]
  clients:       { id: string; name: string; color: string }[]
  currentUserId: string
  canManage:     boolean
}

export function RecurringView({ tasks: initialTasks, members, projects, clients, currentUserId, canManage }: Props) {
  const [localTasks,   setLocalTasks]   = useState<Task[]>(initialTasks)
  const [clientFilter, setClientFilter] = useState<string>('')
  const [subtaskMap,   setSubtaskMap]   = useState<Record<string, any[]>>({})
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set())
  const [newSubInputs, setNewSubInputs] = useState<Record<string,string>>({})
  const router = useRouter()
  const [, startT] = useTransition()
  const [editingId, setEditingId] = useState<string|null>(null)
  const [editForm, setEditForm] = useState<Partial<Task & { frequency: string }>>({})

  function startEdit(task: Task) {
    setEditingId(task.id)
    setEditForm({
      title:     task.title,
      frequency: task.frequency ?? 'weekly',
      priority:  task.priority,
      assignee_id: task.assignee_id ?? '',
      client_id:   task.client_id ?? '',
    })
  }

  async function saveEdit(id: string) {
    // Optimistic: update UI immediately
    const snap = localTasks.map(t => t)
    setLocalTasks(prev => prev.map(t => t.id === id ? {
      ...t,
      title:       editForm.title?.trim() ?? t.title,
      priority:    editForm.priority as any ?? t.priority,
      assignee_id: editForm.assignee_id || null,
      client_id:   editForm.client_id   || null,
      frequency:   editForm.frequency   ?? (t as any).frequency,
    } : t))
    setEditingId(null)

    const [res] = await Promise.all([
      fetch(`/api/tasks/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editForm.title?.trim(), priority: editForm.priority, assignee_id: editForm.assignee_id || null, client_id: editForm.client_id || null }),
      }),
      fetch(`/api/recurring/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frequency: editForm.frequency }),
      }).catch(() => ({})),
    ])
    if (res.ok) { toast.success('Updated'); startT(() => router.refresh()) }
    else { setLocalTasks(snap); setEditingId(id); const d = await (res as Response).json().catch(() => ({})); toast.error(d.error ?? 'Failed to save') }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this recurring task? All future instances will stop being created.')) return
    // Optimistic: remove immediately
    const snap = localTasks.map(t => t)
    setLocalTasks(prev => prev.filter(t => t.id !== id))
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Deleted'); startT(() => router.refresh()) }
    else { setLocalTasks(snap); const d = await res.json().catch(() => ({})); toast.error(d.error ?? 'Failed') }
  }

  // Subtasks load lazily on user click only

  async function toggleSubExpand(taskId: string) {
    setExpandedSubs(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) { next.delete(taskId); return next }
      next.add(taskId); return next
    })
    if (!subtaskMap[taskId]) {
      const r = await fetch(`/api/tasks?parent_id=${taskId}&limit=50`)
      const d = await r.json()
      setSubtaskMap(p => ({ ...p, [taskId]: d.data ?? [] }))
    }
  }

  async function toggleSubDone(taskId: string, subId: string, status: string, subTitle: string) {
    const newStatus = status === 'completed' ? 'todo' : 'completed'
    if (newStatus === 'completed') {
      // REQUIRED: any attachment must be uploaded (filename can be anything)
      const attRes = await fetch(`/api/tasks/${subId}/attachments`)
      const attData = await attRes.json().catch(() => ({ data: [] }))
      if ((attData.data ?? []).length === 0) {
        toast.error('📎 Please upload the required document before completing this subtask')
        return
      }
    }
    setSubtaskMap(p => ({ ...p, [taskId]: (p[taskId]??[]).map(s => s.id===subId ? {...s,status:newStatus} : s) }))
    await fetch(`/api/tasks/${subId}`, {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ status: newStatus, completed_at: newStatus==='completed' ? new Date().toISOString() : null })
    })
    const r = await fetch(`/api/tasks?parent_id=${taskId}&limit=50`)
    const d = await r.json()
    setSubtaskMap(p => ({ ...p, [taskId]: d.data ?? [] }))
  }

  async function uploadSubAttachment(subId: string, file: File) {
    const fd = new FormData(); fd.append('file', file)
    const res = await fetch(`/api/tasks/${subId}/attachments`, { method:'POST', body: fd })
    if (res.ok) toast.success(`Uploaded: ${file.name}`)
    else toast.error('Upload failed')
  }

  async function addSubtask(taskId: string, title: string) {
    if (!title.trim()) return
    const { data: mb_data } = await fetch('/api/tasks').then(r=>r.json()).catch(()=>({data:null}))
    await fetch('/api/tasks', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ title: title.trim(), parent_task_id: taskId, status:'todo', priority:'medium' })
    })
    const r = await fetch(`/api/tasks?parent_id=${taskId}&limit=50`)
    const d = await r.json()
    setSubtaskMap(p => ({ ...p, [taskId]: d.data ?? [] }))
    setNewSubInputs(p => ({ ...p, [taskId]: '' }))
  }

  return (
    <div className="page-container">
      <div style={{ marginBottom: 24 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 0 }}>Recurring tasks</h1>
          {clients.length > 0 && (
            <select value={clientFilter} onChange={e => setClientFilter(e.target.value)}
              style={{ padding:'5px 10px', borderRadius:20, fontSize:12, cursor:'pointer', outline:'none',
                border: clientFilter ? '1px solid var(--brand)' : '1px solid var(--border)',
                background: clientFilter ? 'rgba(13,148,136,0.08)' : 'var(--surface-subtle)',
                color: clientFilter ? 'var(--brand)' : 'var(--text-secondary)',
                fontWeight: clientFilter ? 600 : 400, fontFamily:'inherit', appearance:'none', paddingRight:20 }}>
              <option value=''>All clients</option>
              {clients.map(cl => <option key={cl.id} value={cl.id}>{cl.name}</option>)}
            </select>
          )}
          {clientFilter && <button onClick={() => setClientFilter('')}
            style={{ fontSize:11, color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer' }}>✕ Clear</button>}
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{localTasks.length} active · instances spawn automatically each morning at 7 AM IST</p>
      </div>

      <div className="card-elevated overflow-hidden mb-4">
        {/* Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 7rem 5rem 6rem 5rem 4.5rem',
          padding: '10px 16px', borderBottom: '1px solid var(--border)',
          background: 'var(--surface-subtle)',
          fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          <div>Task</div>
          <div style={{textAlign:'center'}}>Frequency</div>
          <div style={{textAlign:'center'}}>Next due</div>
          <div style={{textAlign:'center'}}>Assignee</div>
          <div style={{textAlign:'center'}}>Client</div>
          <div/>
        </div>

        {localTasks.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 24px' }}>
            <RefreshCw style={{ width: 36, height: 36, color: 'var(--border)', margin: '0 auto 12px' }}/>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>No recurring tasks yet</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Use the row below to set up your first recurring task</p>
          </div>
        )}

        {localTasks.filter(t => !clientFilter || t.client_id === clientFilter).map(task => editingId === task.id ? (
          /* ── Edit row ── */
          <div key={task.id} style={{
            padding: '12px 16px', borderBottom: '1px solid var(--border)',
            background: 'var(--brand-light)', display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <input
              value={editForm.title ?? ''}
              onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
              style={{ fontSize: 14, fontWeight: 500, border: '1px solid var(--border)',
                borderRadius: 7, padding: '6px 10px', background: 'var(--surface)',
                color: 'var(--text-primary)', outline: 'none', width: '100%' }}
            />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <select value={editForm.frequency} onChange={e => setEditForm(f => ({ ...f, frequency: e.target.value }))}
                style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)',
                  background: 'var(--surface)', color: 'var(--text-secondary)' }}>
                {Object.entries(FREQ_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <select value={editForm.assignee_id ?? ''} onChange={e => setEditForm(f => ({ ...f, assignee_id: e.target.value }))}
                style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)',
                  background: 'var(--surface)', color: 'var(--text-secondary)' }}>
                <option value="">Unassigned</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <select value={editForm.client_id ?? ''} onChange={e => setEditForm(f => ({ ...f, client_id: e.target.value }))}
                style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)',
                  background: 'var(--surface)', color: 'var(--text-secondary)' }}>
                <option value="">No client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <button onClick={() => saveEdit(task.id)} style={{
                  padding: '5px 14px', borderRadius: 6, border: 'none',
                  background: 'var(--brand)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>Save</button>
                <button onClick={() => setEditingId(null)} style={{
                  padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)',
                  background: 'var(--surface)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
                }}>Cancel</button>
              </div>
            </div>
          </div>
        ) : (
          /* ── Normal row ── */
          <div key={task.id} className="group" style={{
            display: 'grid', gridTemplateColumns: '1fr 7rem 5rem 6rem 5rem 4.5rem',
            alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)',
            transition: 'background 0.1s',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-subtle)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <RefreshCw style={{ width: 13, height: 13, color: 'var(--brand)', flexShrink: 0 }}/>
              <div style={{ minWidth: 0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin:0 }}>
                    {task.title}
                  </p>
                  <button onClick={e => { e.stopPropagation(); toggleSubExpand(task.id) }}
                    style={{ flexShrink:0, fontSize:10, padding:'1px 7px', borderRadius:99, border:'none',
                      background: expandedSubs.has(task.id) ? 'rgba(13,148,136,0.15)' : 'var(--border-light)',
                      color: expandedSubs.has(task.id) ? 'var(--brand)' : 'var(--text-muted)',
                      cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
                    {subtaskMap[task.id]?.length > 0
                      ? `${subtaskMap[task.id].filter((s:any)=>s.status==='completed').length}/${subtaskMap[task.id].length} subtasks`
                      : expandedSubs.has(task.id) ? '▲ hide' : '+ subtasks'}
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  {task.project && (
                    <><div style={{ width: 7, height: 7, borderRadius: 2, background: task.project.color, flexShrink: 0 }}/>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.project.name}</span></>
                  )}
                  <PriorityBadge priority={task.priority as any}/>
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 99, fontWeight: 600,
                background: 'var(--brand-light)', color: 'var(--brand)' }}>
                {FREQ_LABELS[task.frequency ?? ''] ?? task.frequency}
              </span>
            </div>

            <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
              {task.next_occurrence_date ? fmtDate(task.next_occurrence_date) : '—'}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              {task.assignee
                ? <Avatar name={task.assignee.name} size="xs"/>
                : <div style={{ width: 20, height: 20, borderRadius: '50%', border: '1.5px dashed var(--border)' }}/>}
            </div>

            <div style={{ textAlign: 'center' }}>
              {task.client
                ? <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                    <div style={{ width: 7, height: 7, borderRadius: 2, background: task.client.color, flexShrink: 0 }}/>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 60 }}>{task.client.name}</span>
                  </div>
                : <span style={{ fontSize: 11, color: 'var(--border)' }}>—</span>}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
              {canManage && (
                <>
                  <button onClick={() => startEdit(task)}
                    style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--brand)'; (e.currentTarget as HTMLElement).style.background = 'var(--brand-light)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                    <Pencil style={{ width: 12, height: 12 }}/>
                  </button>
                  <button onClick={() => handleDelete(task.id)}
                    style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#dc2626'; (e.currentTarget as HTMLElement).style.background = '#fff1f2' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                    <X style={{ width: 12, height: 12 }}/>
                  </button>
                </>
              )}
            </div>

          {/* Subtasks section */}
          {expandedSubs.has(task.id) && (
            <div style={{ background:'var(--surface-subtle)', borderTop:'1px solid var(--border-light)' }}>
              {(subtaskMap[task.id] ?? []).map((sub: any) => (
                <div key={sub.id} style={{ display:'flex', alignItems:'center', gap:8,
                  padding:'6px 16px 6px 40px', borderBottom:'1px solid var(--border-light)', background:'var(--surface-subtle)' }}>
                  <button onClick={() => toggleSubDone(task.id, sub.id, sub.status, sub.title)}
                    style={{ width:14, height:14, borderRadius:'50%', border:'none', flexShrink:0, cursor:'pointer',
                      background: sub.status==='completed' ? 'var(--brand)' : 'transparent',
                      outline:`2px solid ${sub.status==='completed' ? 'var(--brand)' : 'var(--border)'}`,
                      display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {sub.status==='completed' && (
                      <svg viewBox="0 0 10 10" fill="none" style={{width:8,height:8}}>
                        <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                      </svg>
                    )}
                  </button>
                  <span style={{ flex:1, fontSize:12,
                    color: sub.status==='completed' ? 'var(--text-muted)' : 'var(--text-primary)',
                    textDecoration: sub.status==='completed' ? 'line-through' : 'none' }}>{sub.title}</span>
                  {sub.status !== 'completed' && (
                    <label title="Upload document" style={{ cursor:'pointer', flexShrink:0 }}>
                      <input type="file" style={{ display:'none' }}
                        onChange={async e => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          await uploadSubAttachment(sub.id, file)
                          e.target.value = ''
                        }}/>
                      <svg viewBox="0 0 16 16" fill="none" style={{ width:13, height:13, color:'var(--text-muted)' }}
                        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M8 10V3M5 6l3-3 3 3M3 13h10"/>
                      </svg>
                    </label>
                  )}
                </div>
              ))}
              {/* Inline add subtask */}
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 16px 6px 40px' }}>
                <div style={{ width:14, height:14, borderRadius:'50%', flexShrink:0,
                  border:'1.5px dashed var(--brand)', opacity:0.5 }}/>
                <input value={newSubInputs[task.id] ?? ''}
                  onChange={e => setNewSubInputs(p => ({...p, [task.id]: e.target.value}))}
                  onKeyDown={e => {
                    if (e.key==='Enter' && (newSubInputs[task.id]??'').trim()) {
                      addSubtask(task.id, newSubInputs[task.id])
                    }
                    if (e.key==='Escape') setNewSubInputs(p => ({...p, [task.id]:''}))
                  }}
                  placeholder="Add subtask… (Enter to save)"
                  style={{ flex:1, fontSize:12, border:'none', outline:'none',
                    background:'transparent', color:'var(--text-primary)' }}
                />
              </div>
            </div>
          )}

          </div>
        ))}

        {canManage && (
          <InlineRecurringTask members={members} clients={clients}
            currentUserId={currentUserId} onCreated={(newTask?: any) => {
              if (newTask) {
                setLocalTasks(p => [...p, newTask])
                // Don't call router.refresh() immediately - causes page break
                // User will see new task instantly via localTasks state
              }
            }}/>
        )}
      </div>

      <p style={{ fontSize: 11, textAlign: 'center', color: 'var(--text-muted)', marginTop: 8 }}>
        ⏰ New instances are created each morning at 7:00 AM IST
      </p>
    </div>
  )
}
