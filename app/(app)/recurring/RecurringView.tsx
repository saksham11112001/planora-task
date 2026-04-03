'use client'
import React from 'react'
import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel'
import { toast } from '@/store/appStore'
import { Plus } from 'lucide-react'

interface Task {
  id: string; title: string; status: string; priority: string
  frequency: string | null; next_occurrence_date: string | null
  assignee_id: string | null; approver_id?: string | null; client_id: string | null
  assignee: { id: string; name: string } | null
  project:  { id: string; name: string; color: string } | null
  client:   { id: string; name: string; color: string } | null
}

interface Props {
  tasks:        Task[]
  members:      { id: string; name: string }[]
  projects:     { id: string; name: string; color: string }[]
  clients:      { id: string; name: string; color: string }[]
  currentUserId: string
  canManage:    boolean
  userRole?:    string
}

const FREQ_LABELS: Record<string, string> = {
  daily:'Daily', weekly:'Weekly', bi_weekly:'Bi-weekly',
  monthly:'Monthly', quarterly:'Quarterly', annual:'Annual', yearly:'Annual',
}
const FREQ_COLORS: Record<string, string> = {
  daily:'#dc2626', weekly:'#ea580c', bi_weekly:'#d97706',
  monthly:'#0d9488', quarterly:'#7c3aed', annual:'#0891b2', yearly:'#0891b2',
}
const PRIORITY_COLORS: Record<string, string> = {
  urgent:'#dc2626', high:'#ea580c', medium:'#ca8a04', low:'#16a34a', none:'#94a3b8',
}

// Default next occurrence: tomorrow
function defaultNextOccurrence() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

export function RecurringView({ tasks: initialTasks, members, projects, clients, currentUserId, canManage, userRole }: Props) {
  const router     = useRouter()
  const [, startT] = useTransition()
  const titleRef   = useRef<HTMLInputElement>(null)

  const [localTasks,   setLocalTasks]   = useState<Task[]>(initialTasks)
  const [clientFilter, setClientFilter] = useState('')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [editingId,    setEditingId]    = useState<string|null>(null)
  const [editForm,     setEditForm]     = useState<Partial<Task & {frequency:string}>>({})
  const [subtaskMap,   setSubtaskMap]   = useState<Record<string,any[]>>({})
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set())
  const [newSubInputs, setNewSubInputs] = useState<Record<string,string>>({})
  const [viewTab,      setViewTab]      = useState<'List'|'Board'>('List')
  const [boardClient,  setBoardClient]  = useState('')

  // ── Inline create state ───────────────────────────────────────────────
  const [showCreate,  setShowCreate]  = useState(false)
  const [creating,    setCreating]    = useState(false)
  const [newTitle,    setNewTitle]    = useState('')
  const [newFreq,     setNewFreq]     = useState('weekly')
  const [newAssignee, setNewAssignee] = useState('')
  const [newApprover, setNewApprover] = useState('')
  const [newClient,   setNewClient]   = useState('')
  const [newPriority, setNewPriority] = useState('medium')
  const [newNextDate, setNewNextDate] = useState(defaultNextOccurrence)

  function openCreate() {
    setShowCreate(true)
    setNewTitle(''); setNewFreq('weekly'); setNewAssignee(''); setNewApprover('')
    setNewClient(''); setNewPriority('medium'); setNewNextDate(defaultNextOccurrence())
    setTimeout(() => titleRef.current?.focus(), 50)
  }

  async function createRecurring() {
    if (!newTitle.trim()) { toast.error('Title is required'); return }
    setCreating(true)
    const res = await fetch('/api/tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title:                newTitle.trim(),
        is_recurring:         true,
        frequency:            newFreq,
        next_occurrence_date: newNextDate || null,
        assignee_id:          newAssignee  || null,
        approver_id:          newApprover  || null,
        approval_required:    !!newApprover,
        client_id:            newClient    || null,
        priority:             newPriority,
        status:               'todo',
      }),
    })
    const d = await res.json()
    setCreating(false)
    if (!res.ok) { toast.error(d.error ?? 'Could not create task'); return }
    toast.success('Recurring task created ✓')
    // Optimistic add
    if (d.data) {
      const created = d.data
      setLocalTasks(p => [...p, {
        id: created.id, title: created.title, status: created.status,
        priority: created.priority, frequency: created.frequency,
        next_occurrence_date: created.next_occurrence_date,
        assignee_id: created.assignee_id, client_id: created.client_id,
        approver_id: null,
        assignee: members.find(m => m.id === created.assignee_id) ?? null,
        project:  null,
        client:   clients.find(c => c.id === created.client_id) ?? null,
      }])
    }
    setShowCreate(false)
    startT(() => router.refresh())
  }

  function startEdit(task: Task) {
    setEditingId(task.id)
    setEditForm({ title:task.title, frequency:task.frequency??'weekly', priority:task.priority, assignee_id:task.assignee_id??'', client_id:task.client_id??'' })
  }

  async function saveEdit(id: string) {
    const prev = localTasks.find(t => t.id===id)
    if (!prev) return
    setLocalTasks(p => p.map(t => t.id===id ? { ...t, ...editForm, assignee: members.find(m=>m.id===editForm.assignee_id)||t.assignee, client: clients.find(c=>c.id===editForm.client_id)||t.client } as Task : t))
    setEditingId(null)
    const res = await fetch(`/api/tasks/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ title:editForm.title, frequency:editForm.frequency, priority:editForm.priority, assignee_id:editForm.assignee_id||null, client_id:editForm.client_id||null }) })
    if (!res.ok) { setLocalTasks(p => p.map(t => t.id===id ? prev : t)); toast.error('Could not save') }
    else { toast.success('Saved ✓'); startT(() => router.refresh()) }
  }

  async function deleteTask(id: string) {
    if (!confirm('Delete this recurring task?')) return
    setLocalTasks(p => p.filter(t => t.id!==id))
    const res = await fetch(`/api/tasks/${id}`, { method:'DELETE' })
    if (!res.ok) { toast.error('Could not delete'); startT(() => router.refresh()) }
    else toast.success('Deleted')
  }

  async function toggleSub(parentId: string, subId: string, status: string) {
    const newStatus = status==='completed' ? 'todo' : 'completed'
    setSubtaskMap(p => ({ ...p, [parentId]: (p[parentId]??[]).map(s => s.id===subId?{...s,status:newStatus}:s) }))
    await fetch(`/api/tasks/${subId}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status:newStatus }) })
  }

  async function loadSubs(taskId: string) {
    if (subtaskMap[taskId]) return
    const r = await fetch(`/api/tasks?parent_id=${taskId}&limit=50`)
    const d = await r.json()
    setSubtaskMap(p => ({ ...p, [taskId]: d.data??[] }))
  }

  const visibleTasks = clientFilter ? localTasks.filter(t => t.client?.id===clientFilter) : localTasks

  const REC_BOARD_COLS = [
    { freq:'daily',     label:'Daily',     color:'#dc2626' },
    { freq:'weekly',    label:'Weekly',    color:'#ea580c' },
    { freq:'monthly',   label:'Monthly',   color:'#0d9488' },
    { freq:'quarterly', label:'Quarterly', color:'#7c3aed' },
    { freq:'annual',    label:'Annual',    color:'#0891b2' },
  ]

  // ── Inline create row ────────────────────────────────────────────────
  const CreateRow = () => (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 7rem 5rem 6rem 6rem 5rem 4.5rem', alignItems:'center', padding:'8px 16px', borderBottom:'1px solid var(--border)', background:'rgba(13,148,136,0.04)', borderLeft:'3px solid var(--brand)' }}>
      <input
        ref={titleRef}
        value={newTitle}
        onChange={e => setNewTitle(e.target.value)}
        onKeyDown={e => { if (e.key==='Enter') createRecurring(); if (e.key==='Escape') setShowCreate(false) }}
        placeholder="Task title… (Enter to save, Esc to cancel)"
        style={{ fontSize:13, border:'1px solid var(--brand)', borderRadius:6, padding:'5px 8px', background:'var(--surface)', color:'var(--text-primary)', fontFamily:'inherit', outline:'none', width:'100%', boxSizing:'border-box' }}
      />
      <select value={newFreq} onChange={e => setNewFreq(e.target.value)}
        style={{ fontSize:12, border:'1px solid var(--border)', borderRadius:6, padding:'4px 6px', background:'var(--surface)', fontFamily:'inherit', cursor:'pointer' }}>
        {Object.entries(FREQ_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <input type="date" value={newNextDate} onChange={e => setNewNextDate(e.target.value)}
        title="First occurrence date"
        style={{ fontSize:11, border:'1px solid var(--border)', borderRadius:6, padding:'4px 4px', background:'var(--surface)', fontFamily:'inherit', color:'var(--text-primary)', outline:'none', width:'100%', boxSizing:'border-box' }} />
      <select value={newAssignee} onChange={e => setNewAssignee(e.target.value)}
        style={{ fontSize:12, border:'1px solid var(--border)', borderRadius:6, padding:'4px 6px', background:'var(--surface)', fontFamily:'inherit', cursor:'pointer' }}>
        <option value=''>Unassigned</option>
        {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <select value={newApprover} onChange={e => setNewApprover(e.target.value)}
        style={{ fontSize:12, border: newApprover ? '1px solid #7c3aed' : '1px solid var(--border)', borderRadius:6, padding:'4px 6px', background: newApprover ? '#f5f3ff' : 'var(--surface)', fontFamily:'inherit', cursor:'pointer', color: newApprover ? '#7c3aed' : 'inherit' }}>
        <option value=''>No approver</option>
        {members.filter(m => (m as any).role && ['owner','admin','manager'].includes((m as any).role)).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <select value={newClient} onChange={e => setNewClient(e.target.value)}
        style={{ fontSize:12, border:'1px solid var(--border)', borderRadius:6, padding:'4px 6px', background:'var(--surface)', fontFamily:'inherit', cursor:'pointer' }}>
        <option value=''>No client</option>
        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <div style={{ display:'flex', gap:4 }}>
        <button onClick={createRecurring} disabled={creating}
          style={{ padding:'4px 10px', background:'var(--brand)', color:'#fff', border:'none', borderRadius:6, fontSize:12, cursor:creating?'not-allowed':'pointer', fontFamily:'inherit', opacity:creating?0.7:1 }}>
          {creating ? '…' : 'Save'}
        </button>
        <button onClick={() => setShowCreate(false)}
          style={{ padding:'4px 8px', background:'var(--surface-subtle)', color:'var(--text-secondary)', border:'1px solid var(--border)', borderRadius:6, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>✕</button>
      </div>
    </div>
  )

  return (
    <div className="page-container">

      <div style={{ display:'flex', borderBottom:'1px solid var(--border)', marginBottom:0, background:'var(--surface)', flexShrink:0 }}>
        {(['List','Board'] as const).map(t => (
          <button key={t} onClick={() => setViewTab(t)}
            style={{ padding:'10px 15px', fontSize:14, fontWeight:500, border:'none', background:'transparent', cursor:'pointer', marginBottom:-1, borderBottom:`2px solid ${viewTab===t?'var(--brand)':'transparent'}`, color:viewTab===t?'var(--brand)':'var(--text-muted)' }}>
            {t}
          </button>
        ))}
      </div>

      {viewTab === 'Board' && (
        <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
          {clients.length > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 20px', borderBottom:'1px solid var(--border-light)', background:'var(--surface)' }}>
              <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' }}>Client</span>
              <select value={boardClient} onChange={e => setBoardClient(e.target.value)}
                style={{ padding:'4px 10px', borderRadius:20, fontSize:12, cursor:'pointer', outline:'none', border:boardClient?'1px solid var(--brand)':'1px solid var(--border)', background:boardClient?'rgba(13,148,136,0.08)':'var(--surface-subtle)', color:boardClient?'var(--brand)':'var(--text-secondary)', fontFamily:'inherit', appearance:'none' }}>
                <option value=''>All clients</option>
                {clients.map(cl => <option key={cl.id} value={cl.id}>{cl.name}</option>)}
              </select>
            </div>
          )}
          <div style={{ flex:1, overflowX:'auto', overflowY:'hidden', padding:'14px 20px', background:'var(--surface-subtle)', display:'flex', gap:12, alignItems:'flex-start' }}>
            {REC_BOARD_COLS.map(col => {
              const colTasks = localTasks.filter(t => t.frequency===col.freq && (!boardClient || t.client?.id===boardClient))
              return (
                <div key={col.freq} style={{ minWidth:200, flex:'0 0 200px', background:'var(--surface)', borderRadius:10, border:'1px solid var(--border)', display:'flex', flexDirection:'column', maxHeight:'100%' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7, padding:'10px 12px', borderBottom:'1px solid var(--border)' }}>
                    <span style={{ width:8, height:8, borderRadius:'50%', background:col.color, flexShrink:0 }}/>
                    <span style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)' }}>{col.label}</span>
                    <span style={{ marginLeft:'auto', fontSize:11, color:'var(--text-muted)' }}>{colTasks.length}</span>
                  </div>
                  <div style={{ padding:7, display:'flex', flexDirection:'column', gap:6, overflowY:'auto', flex:1 }}>
                    {colTasks.map(task => (
                      <div key={task.id} onClick={() => setSelectedTask(selectedTask?.id===task.id ? null : task as any)}
                        style={{ background:'var(--surface)', borderRadius:8, padding:'9px 10px', cursor:'pointer', border:`1px solid ${selectedTask?.id===task.id?'var(--brand)':'var(--border)'}`, boxShadow:'0 1px 3px rgba(0,0,0,0.05)' }}>
                        {task.client && <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:4 }}>
                          <span style={{ width:6, height:6, borderRadius:1, background:task.client.color??'#0d9488', display:'inline-block' }}/>
                          <span style={{ fontSize:10, color:'var(--text-muted)' }}>{task.client.name}</span>
                        </div>}
                        <p style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', lineHeight:1.3 }}>{task.title}</p>
                        {task.assignee && <p style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>{task.assignee.name}</p>}
                      </div>
                    ))}
                    {colTasks.length===0 && <div style={{ fontSize:12, color:'var(--text-muted)', textAlign:'center', padding:'20px 0', opacity:0.5 }}>No {col.label.toLowerCase()} tasks</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {viewTab === 'List' && (
        <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column' }}>

          {/* Toolbar */}
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 16px', borderBottom:'1px solid var(--border-light)', background:'var(--surface)', flexShrink:0 }}>
            <div style={{ flex:1, display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:12, color:'var(--text-muted)', fontWeight:500 }}>
                {visibleTasks.length} active · instances spawn automatically each morning at 7 AM IST
              </span>
              {clients.length > 0 && (
                <select value={clientFilter} onChange={e => setClientFilter(e.target.value)}
                  style={{ padding:'4px 10px', borderRadius:20, fontSize:12, cursor:'pointer', outline:'none', border:clientFilter?'1px solid var(--brand)':'1px solid var(--border)', background:clientFilter?'rgba(13,148,136,0.08)':'var(--surface-subtle)', color:clientFilter?'var(--brand)':'var(--text-secondary)', fontWeight:clientFilter?600:400, fontFamily:'inherit', appearance:'none', paddingRight:20 }}>
                  <option value=''>All clients</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </div>
            {canManage && (
              <button onClick={openCreate}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:8, background:'var(--brand)', color:'#fff', border:'none', cursor:'pointer', fontSize:13, fontWeight:600, fontFamily:'inherit' }}>
                <Plus style={{ width:15, height:15 }} /> New recurring task
              </button>
            )}
          </div>

          {/* Column headers */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 7rem 5rem 6rem 6rem 5rem 4.5rem', padding:'10px 16px', borderBottom:'1px solid var(--border)', background:'var(--surface-subtle)', fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', flexShrink:0 }}>
            <span>Task</span><span style={{textAlign:'center'}}>Frequency</span>
            <span style={{textAlign:'center'}}>Next due</span><span style={{textAlign:'center'}}>Assignee</span>
            <span style={{textAlign:'center'}}>Approver</span><span style={{textAlign:'center'}}>Client</span><span/>
          </div>

          {/* Inline create row — appears at the top */}
          {showCreate && <CreateRow />}

          {/* Empty state */}
          {visibleTasks.length===0 && !showCreate && (
            <div style={{ textAlign:'center', padding:'48px 24px' }}>
              <p style={{ fontSize:14, color:'var(--text-muted)', marginBottom:12 }}>No recurring tasks yet</p>
              {canManage && (
                <button onClick={openCreate}
                  style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 18px', borderRadius:8, background:'var(--brand)', color:'#fff', border:'none', cursor:'pointer', fontSize:13, fontWeight:600, fontFamily:'inherit' }}>
                  <Plus style={{ width:15, height:15 }} /> Create your first recurring task
                </button>
              )}
            </div>
          )}

          {/* Task rows */}
          {visibleTasks.map(task => {
            const isEditing = editingId===task.id
            const freqColor = FREQ_COLORS[task.frequency??'']??'var(--text-muted)'
            const freqLabel = FREQ_LABELS[task.frequency??'']??task.frequency??'—'

            if (isEditing) return (
              <div key={task.id} style={{ display:'grid', gridTemplateColumns:'1fr 7rem 5rem 6rem 6rem 5rem 4.5rem', alignItems:'center', padding:'8px 16px', borderBottom:'1px solid var(--border)', background:'var(--brand-light)' }}>
                <input value={editForm.title??''} onChange={e => setEditForm(p => ({ ...p, title:e.target.value }))}
                  style={{ fontSize:13, border:'1px solid var(--brand)', borderRadius:6, padding:'4px 8px', background:'var(--surface)', color:'var(--text-primary)', fontFamily:'inherit', outline:'none' }}/>
                <select value={editForm.frequency??'weekly'} onChange={e => setEditForm(p => ({ ...p, frequency:e.target.value }))}
                  style={{ fontSize:12, border:'1px solid var(--border)', borderRadius:6, padding:'3px 6px', background:'var(--surface)', fontFamily:'inherit', cursor:'pointer' }}>
                  {Object.keys(FREQ_LABELS).map(f => <option key={f} value={f}>{FREQ_LABELS[f]}</option>)}
                </select>
                <div/>
                <select value={editForm.assignee_id??''} onChange={e => setEditForm(p => ({ ...p, assignee_id:e.target.value }))}
                  style={{ fontSize:12, border:'1px solid var(--border)', borderRadius:6, padding:'3px 6px', background:'var(--surface)', fontFamily:'inherit', cursor:'pointer' }}>
                  <option value=''>Unassigned</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <select value={editForm.client_id??''} onChange={e => setEditForm(p => ({ ...p, client_id:e.target.value }))}
                  style={{ fontSize:12, border:'1px solid var(--border)', borderRadius:6, padding:'3px 6px', background:'var(--surface)', fontFamily:'inherit', cursor:'pointer' }}>
                  <option value=''>No client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div style={{ display:'flex', gap:4 }}>
                  <button onClick={() => saveEdit(task.id)} style={{ padding:'4px 10px', background:'var(--brand)', color:'#fff', border:'none', borderRadius:6, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>Save</button>
                  <button onClick={() => setEditingId(null)} style={{ padding:'4px 8px', background:'var(--surface-subtle)', color:'var(--text-secondary)', border:'1px solid var(--border)', borderRadius:6, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>✕</button>
                </div>
              </div>
            )

            return (
              <div key={task.id} className="group" style={{ borderBottom:'1px solid var(--border-light)' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 7rem 5rem 6rem 6rem 5rem 4.5rem', alignItems:'center', padding:'10px 16px', cursor:'pointer' }}
                  onClick={() => setSelectedTask(selectedTask?.id===task.id ? null : task as any)}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                    <button onClick={e => { e.stopPropagation(); setExpandedSubs(p => { const n=new Set(p); n.has(task.id)?n.delete(task.id):n.add(task.id); return n }); loadSubs(task.id) }}
                      style={{ width:16, height:16, borderRadius:4, border:'1px solid var(--border)', background:'var(--surface-subtle)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, fontSize:10, color:'var(--text-muted)' }}>
                      {expandedSubs.has(task.id) ? '−' : '+'}
                    </button>
                    <div style={{ minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{task.title}</span>
                        <span style={{ fontSize:10, fontWeight:700, padding:'1px 5px', borderRadius:3, background:`${PRIORITY_COLORS[task.priority]??'#94a3b8'}18`, color:PRIORITY_COLORS[task.priority]??'#94a3b8', flexShrink:0 }}>{task.priority}</span>
                      </div>
                      {task.project && (
                        <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:2 }}>
                          <div style={{ width:7, height:7, borderRadius:2, background:task.project.color }}/>
                          <span style={{ fontSize:11, color:'var(--text-muted)' }}>{task.project.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign:'center' }}>
                    <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20, background:`${freqColor}18`, color:freqColor }}>{freqLabel}</span>
                  </div>
                  <div style={{ textAlign:'center', fontSize:12, color:'var(--text-muted)' }}>
                    {task.next_occurrence_date ? task.next_occurrence_date.slice(0,10) : '—'}
                  </div>
                  <div style={{ display:'flex', justifyContent:'center' }}>
                    {task.assignee
                      ? <div style={{ width:20, height:20, borderRadius:'50%', background:'#0d9488', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:8, fontWeight:700 }}>{task.assignee.name[0]?.toUpperCase()}</div>
                      : <div style={{ width:20, height:20, borderRadius:'50%', border:'1.5px dashed var(--border)' }}/>
                    }
                  </div>
                  {/* Approver */}
                  <div style={{ display:'flex', justifyContent:'center' }}>
                    {(task as any).approver_id && members.find(m => m.id === (task as any).approver_id)
                      ? <div style={{ width:20, height:20, borderRadius:'50%', background:'#7c3aed', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:8, fontWeight:700, title: members.find(m => m.id === (task as any).approver_id)?.name }}>
                          {members.find(m => m.id === (task as any).approver_id)?.name?.[0]?.toUpperCase()}
                        </div>
                      : <div style={{ width:20, height:20, borderRadius:'50%', border:'1.5px dashed var(--border)' }}/>
                    }
                  </div>
                  <div style={{ textAlign:'center' }}>
                    {task.client
                      ? <div style={{ display:'flex', alignItems:'center', gap:4, justifyContent:'center' }}>
                          <div style={{ width:7, height:7, borderRadius:2, background:task.client.color }}/>
                          <span style={{ fontSize:11, color:'var(--text-muted)', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', maxWidth:60 }}>{task.client.name}</span>
                        </div>
                      : <span style={{ fontSize:11, color:'var(--text-muted)' }}>—</span>
                    }
                  </div>
                  <div style={{ display:'flex', justifyContent:'center', gap:2 }}>
                    {canManage && (
                      <>
                        <button onClick={e => { e.stopPropagation(); startEdit(task) }}
                          style={{ padding:'3px 8px', fontSize:11, border:'1px solid var(--border)', borderRadius:5, background:'var(--surface)', cursor:'pointer', color:'var(--text-secondary)', fontFamily:'inherit' }}>Edit</button>
                        <button onClick={e => { e.stopPropagation(); deleteTask(task.id) }}
                          style={{ padding:'3px 6px', fontSize:11, border:'1px solid #fecaca', borderRadius:5, background:'#fef2f2', cursor:'pointer', color:'#dc2626', fontFamily:'inherit' }}>✕</button>
                      </>
                    )}
                  </div>
                </div>

                {expandedSubs.has(task.id) && (
                  <div style={{ background:'var(--surface-subtle)', borderTop:'1px solid var(--border-light)' }}>
                    {(subtaskMap[task.id]??[]).map((sub:any) => (
                      <div key={sub.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 16px 5px 46px', borderBottom:'1px solid var(--border-light)' }}>
                        <button onClick={() => toggleSub(task.id, sub.id, sub.status)}
                          style={{ width:13, height:13, borderRadius:'50%', flexShrink:0, border:'none', background:sub.status==='completed'?'var(--brand)':'transparent', outline:`2px solid ${sub.status==='completed'?'var(--brand)':'var(--border)'}`, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          {sub.status==='completed' && <svg viewBox="0 0 10 10" fill="none" style={{ width:7, height:7 }}><path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/></svg>}
                        </button>
                        <span style={{ flex:1, fontSize:12, color:sub.status==='completed'?'var(--text-muted)':'var(--text-primary)', textDecoration:sub.status==='completed'?'line-through':'none' }}>{sub.title}</span>
                      </div>
                    ))}
                    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 16px 6px 46px' }}>
                      <div style={{ width:13, height:13, borderRadius:'50%', flexShrink:0, border:'1.5px dashed var(--brand)', opacity:0.5 }}/>
                      <input value={newSubInputs[task.id]??''} onChange={e => setNewSubInputs(p => ({ ...p, [task.id]:e.target.value }))}
                        onKeyDown={async e => {
                          if (e.key==='Enter' && (newSubInputs[task.id]??'').trim()) {
                            const r = await fetch('/api/tasks', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ title:newSubInputs[task.id].trim(), parent_task_id:task.id, status:'todo' }) })
                            const d = await r.json()
                            if (r.ok && d.data) setSubtaskMap(p => ({ ...p, [task.id]:[...(p[task.id]??[]),d.data] }))
                            setNewSubInputs(p => ({ ...p, [task.id]:'' }))
                          }
                        }}
                        placeholder="Add subtask… (Enter)" style={{ flex:1, fontSize:12, border:'none', outline:'none', background:'transparent', color:'var(--text-primary)' }}/>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* Add row button at bottom when tasks exist */}
          {canManage && visibleTasks.length > 0 && !showCreate && (
            <button onClick={openCreate}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 16px', border:'none', background:'transparent', cursor:'pointer', color:'var(--text-muted)', fontSize:13, fontFamily:'inherit', borderTop:'1px solid var(--border-light)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color='var(--brand)'; (e.currentTarget as HTMLElement).style.background='rgba(13,148,136,0.04)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color='var(--text-muted)'; (e.currentTarget as HTMLElement).style.background='transparent' }}>
              <Plus style={{ width:14, height:14 }}/> Add recurring task
            </button>
          )}

          <p style={{ fontSize:11, textAlign:'center', color:'var(--text-muted)', marginTop:8, padding:'0 0 12px' }}>
            ⏰ New instances are created each morning at 7:00 AM IST
          </p>

          <TaskDetailPanel task={selectedTask} members={members} clients={clients}
            currentUserId={currentUserId} userRole={userRole}
            onClose={() => setSelectedTask(null)}
            onUpdated={() => { setSelectedTask(null); startT(() => router.refresh()) }}/>
        </div>
      )}
    </div>
  )
}