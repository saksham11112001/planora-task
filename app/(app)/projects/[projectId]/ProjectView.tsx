'use client'
import Link from 'next/link'
import { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter }    from 'next/navigation'
import { Filter, SortAsc, Plus, CheckCheck, Clock, DollarSign } from 'lucide-react'
import { InlineTaskRow }   from '@/components/tasks/InlineTaskRow'
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel'
import { PriorityBadge, Avatar }   from '@/components/ui/Badge'
import { cn }              from '@/lib/utils/cn'
import { toast }           from '@/store/appStore'
import { fmtDate, isOverdue, todayStr, fmtHours } from '@/lib/utils/format'
import { STATUS_CONFIG, PRIORITY_CONFIG }  from '@/types'
import type { Task }       from '@/types'

interface Props {
  project: { id: string; name: string; color: string; status: string; description?: string|null; due_date?: string|null; budget?: number|null; hours_budget?: number|null }
  tasks: Task[]; members: { id: string; name: string }[]; clients: { id: string; name: string; color: string }[]
  defaultClientId: string; projectOwnerId?: string; canManage: boolean; currentUserId?: string; userRole?: string
  totalHours: number; billableHours: number
}

type ViewTab = 'list' | 'board' | 'overview'

const BOARD_COLS = [
  { status: 'todo',        label: 'To do',       color:'var(--text-muted)' },
  { status: 'in_progress', label: 'In progress',  color: '#0d9488' },
  { status: 'in_review',   label: 'In review',    color: '#7c3aed' },
  { status: 'completed',   label: 'Done',         color: '#16a34a' },
]

export function ProjectView({ project, tasks, members, clients, defaultClientId, projectOwnerId, canManage, currentUserId, userRole, totalHours, billableHours }: Props) {
  const router = useRouter()
  const [tab,          setTab]          = useState<ViewTab>('list')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [checked,      setChecked]      = useState<Set<string>>(new Set())
  const [completing,   setCompleting]   = useState<Set<string>>(new Set())
  const [collapsed,    setCollapsed]    = useState<Record<string, boolean>>({})
  const [isPending,    startT]          = useTransition()
  const today = todayStr()
  const toolbarRef = useRef<HTMLDivElement>(null)

  // Close filter/sort dropdowns on outside click
  useEffect(() => {
    function close(e: MouseEvent) {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setFilterOpen(false)
        setSortOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  // Filter + Sort state
  const [filterOpen,   setFilterOpen]   = useState(false)
  const [sortOpen,     setSortOpen]     = useState(false)
  const [filterAssignee, setFilterAssignee] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterStatus,   setFilterStatus]   = useState('')
  const [sortBy,       setSortBy]       = useState<'due_date'|'priority'|'title'|'created'>('due_date')
  const [sortDir,      setSortDir]      = useState<'asc'|'desc'>('asc')

  // Add Section state
  const [addSectionOpen, setAddSectionOpen] = useState(false)
  const [newSectionName, setNewSectionName] = useState('')
  const [customSections, setCustomSections] = useState<{key:string;label:string;color:string}[]>([])

  const total    = tasks.length
  const done     = tasks.filter(t => t.status === 'completed').length
  const progress = total > 0 ? Math.round((done / total) * 100) : 0

  // Apply filters
  const filteredTasks = tasks.filter(t => {
    if (filterAssignee && t.assignee_id !== filterAssignee) return false
    if (filterPriority && t.priority !== filterPriority) return false
    if (filterStatus   && t.status   !== filterStatus)   return false
    return true
  })

  // Apply sort
  const PRIORITY_ORDER: Record<string,number> = { urgent:0, high:1, medium:2, low:3, none:4 }
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    let cmp = 0
    if (sortBy === 'due_date') {
      if (!a.due_date && !b.due_date) cmp = 0
      else if (!a.due_date) cmp = 1
      else if (!b.due_date) cmp = -1
      else cmp = a.due_date.localeCompare(b.due_date)
    } else if (sortBy === 'priority') {
      cmp = (PRIORITY_ORDER[a.priority] ?? 4) - (PRIORITY_ORDER[b.priority] ?? 4)
    } else if (sortBy === 'title') {
      cmp = a.title.localeCompare(b.title)
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  const activeFilters = [filterAssignee, filterPriority, filterStatus].filter(Boolean).length

  const SECTIONS = [
    { key: 'overdue',    label: 'Overdue',    color: '#dc2626', creator: false, tasks: sortedTasks.filter(t => t.status !== 'completed' && isOverdue(t.due_date, t.status)) },
    { key: 'todo',       label: 'To do',      color:'var(--text-secondary)', creator: true,  tasks: sortedTasks.filter(t => t.status === 'todo' && !isOverdue(t.due_date, t.status)) },
    { key: 'inprogress', label: 'In progress',color: '#0d9488', creator: false, tasks: sortedTasks.filter(t => t.status === 'in_progress') },
    { key: 'inreview',   label: 'In review',  color: '#7c3aed', creator: false, tasks: sortedTasks.filter(t => t.status === 'in_review') },
    { key: 'done',       label: 'Done',       color: '#16a34a', creator: false, tasks: sortedTasks.filter(t => t.status === 'completed') },
    ...customSections.map(s => ({ ...s, creator: true, tasks: [] as Task[] })),
  ]

  async function toggleDone(taskId: string, status: string, e: React.MouseEvent) {
    e.stopPropagation()
    setCompleting(p => new Set(p).add(taskId))
    const newStatus = status === 'completed' ? 'todo' : 'completed'
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, completed_at: newStatus === 'completed' ? new Date().toISOString() : null }),
    })
    setCompleting(p => { const s = new Set(p); s.delete(taskId); return s })
    if (newStatus === 'completed') toast.success('Done! 🎉')
    startT(() => router.refresh())
  }

  async function bulkComplete() {
    await Promise.all([...checked].map(id => fetch(`/api/tasks/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed', completed_at: new Date().toISOString() }),
    })))
    setChecked(new Set()); toast.success(`${checked.size} tasks completed`); startT(() => router.refresh())
  }

  function TaskRow({ task }: { task: Task }) {
    const ov       = isOverdue(task.due_date, task.status)
    const isComp   = task.status === 'completed'
    const assignee = task.assignee as unknown as { id: string; name: string } | null
    const statConf = STATUS_CONFIG[task.status]
    return (
      <div className={cn('task-row group', selectedTask?.id === task.id && 'selected', checked.has(task.id) && 'bg-teal-50/60')}>
        <input type="checkbox" checked={checked.has(task.id)}
          onChange={() => setChecked(p => { const s = new Set(p); s.has(task.id) ? s.delete(task.id) : s.add(task.id); return s })}
          onClick={e => e.stopPropagation()} className="h-3.5 w-3.5 rounded border-gray-300 accent-teal-600 flex-shrink-0 cursor-pointer"/>
        <button onClick={e => toggleDone(task.id, task.status, e)}
          className={cn('task-check flex-shrink-0', isComp && 'done', completing.has(task.id) && 'popping')}>
          {isComp && <svg viewBox="0 0 16 16" fill="none" className="h-2.5 w-2.5"><path d="M13 4L6.5 11 3 7.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </button>
        <div className="flex-1 min-w-0" onClick={() => setSelectedTask(task)}>
          <span className={cn('text-sm', isComp ? 'line-through text-gray-400' : ov ? 'text-red-700' : 'text-gray-900')}>{task.title}</span>
        </div>
        <div className="w-36 hidden md:flex items-center gap-2 pl-2" onClick={() => setSelectedTask(task)}>
          {assignee ? <><Avatar name={assignee.name} size="xs"/><span className="text-xs text-gray-500 truncate">{assignee.name}</span></> : <div className="h-5 w-5 rounded-full border border-dashed border-gray-300 opacity-0 group-hover:opacity-100"/>}
        </div>
        <div className="w-24 hidden md:block text-center" onClick={() => setSelectedTask(task)}>
          {task.due_date && <span className="text-xs" style={{ color: ov ? '#dc2626' : '#94a3b8' }}>{fmtDate(task.due_date)}</span>}
        </div>
        <div className="w-24 hidden lg:flex justify-center" onClick={() => setSelectedTask(task)}>
          <PriorityBadge priority={task.priority}/>
        </div>
        <div className="w-28 hidden lg:flex justify-center" onClick={() => setSelectedTask(task)}>
          {task.status !== 'todo' && (
            <span className="status-badge" style={{ background: statConf.bg, color: statConf.color }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: statConf.dot }}/>{statConf.label}
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Progress bar */}
      <div className="px-6 py-2" style={{ background: 'var(--surface)' }}>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${progress}%`, background: progress >= 80 ? '#16a34a' : project.color }}/>
          </div>
          <span className="text-xs text-gray-400">{done}/{total} tasks · {progress}%</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar px-6" style={{ background: 'var(--surface)' }}>
        {(['list','board','overview'] as ViewTab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} className={cn('tab-item capitalize', tab === t && 'active')}>{t}</button>
        ))}
      </div>

      {/* LIST view */}
      {tab === 'list' && (
        <div className="flex flex-col flex-1 min-h-0" style={{ background: 'var(--surface)' }}>
          <div className="toolbar" ref={toolbarRef}>
            {checked.size > 0 ? (
              <><span className="text-sm font-medium text-gray-700 mr-2">{checked.size} selected</span>
                <button onClick={bulkComplete} className="btn btn-brand btn-sm flex items-center gap-1.5"><CheckCheck className="h-3.5 w-3.5"/> Complete</button>
                <button onClick={() => setChecked(new Set())} className="btn btn-ghost btn-sm">Cancel</button></>
            ) : (
              <>
                {/* Filter button */}
                <div style={{position:'relative'}}>
                  <button onClick={() => { setFilterOpen(o=>!o); setSortOpen(false) }}
                    className="toolbar-btn"
                    style={{ color: activeFilters > 0 ? 'var(--brand)' : undefined,
                             background: activeFilters > 0 ? 'var(--brand-light)' : undefined }}>
                    <Filter className="h-3.5 w-3.5"/>
                    Filter{activeFilters > 0 ? ` (${activeFilters})` : ''}
                  </button>
                  {filterOpen && (
                    <div style={{ position:'absolute', top:'100%', left:0, marginTop:4,
                      background:'var(--surface)', border:'1px solid var(--border)',
                      borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,0.12)', zIndex:9999,
                      padding:12, minWidth:220 }} onClick={e=>e.stopPropagation()}>
                      <p style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',
                        textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>Filter by</p>
                      <div style={{display:'flex',flexDirection:'column',gap:8}}>
                        <div>
                          <label style={{fontSize:11,color:'var(--text-muted)',display:'block',marginBottom:3}}>Assignee</label>
                          <select value={filterAssignee} onChange={e=>setFilterAssignee(e.target.value)}
                            style={{width:'100%',padding:'5px 8px',borderRadius:6,border:'1px solid var(--border)',
                              background:'var(--surface)',color:'var(--text-primary)',fontSize:12}}>
                            <option value="">All members</option>
                            {members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{fontSize:11,color:'var(--text-muted)',display:'block',marginBottom:3}}>Priority</label>
                          <select value={filterPriority} onChange={e=>setFilterPriority(e.target.value)}
                            style={{width:'100%',padding:'5px 8px',borderRadius:6,border:'1px solid var(--border)',
                              background:'var(--surface)',color:'var(--text-primary)',fontSize:12}}>
                            <option value="">All priorities</option>
                            {['urgent','high','medium','low','none'].map(p=><option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{fontSize:11,color:'var(--text-muted)',display:'block',marginBottom:3}}>Status</label>
                          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}
                            style={{width:'100%',padding:'5px 8px',borderRadius:6,border:'1px solid var(--border)',
                              background:'var(--surface)',color:'var(--text-primary)',fontSize:12}}>
                            <option value="">All statuses</option>
                            {['todo','in_progress','in_review','completed'].map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}
                          </select>
                        </div>
                        {activeFilters > 0 && (
                          <button onClick={()=>{ setFilterAssignee(''); setFilterPriority(''); setFilterStatus(''); setFilterOpen(false) }}
                            style={{padding:'5px 0',borderRadius:6,border:'none',background:'var(--border-light)',
                              color:'var(--text-secondary)',fontSize:11,fontWeight:600,cursor:'pointer'}}>
                            Clear all filters
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Sort button */}
                <div style={{position:'relative'}}>
                  <button onClick={() => { setSortOpen(o=>!o); setFilterOpen(false) }} className="toolbar-btn"
                    style={{ color: sortBy !== 'due_date' ? 'var(--brand)' : undefined,
                             background: sortBy !== 'due_date' ? 'var(--brand-light)' : undefined }}>
                    <SortAsc className="h-3.5 w-3.5"/>
                    Sort{sortBy !== 'due_date' ? ': '+sortBy.replace('_',' ') : ''}
                  </button>
                  {sortOpen && (
                    <div style={{ position:'absolute', top:'100%', left:0, marginTop:4,
                      background:'var(--surface)', border:'1px solid var(--border)',
                      borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,0.12)', zIndex:9999,
                      padding:12, minWidth:200 }} onClick={e=>e.stopPropagation()}>
                      <p style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',
                        textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>Sort by</p>
                      <div style={{display:'flex',flexDirection:'column',gap:2}}>
                        {([['due_date','Due date'],['priority','Priority'],['title','Title']] as const).map(([val,label])=>(
                          <button key={val} onClick={()=>{
                            if(sortBy===val) setSortDir(d=>d==='asc'?'desc':'asc')
                            else { setSortBy(val); setSortDir('asc') }
                          }} style={{
                            display:'flex', alignItems:'center', justifyContent:'space-between',
                            padding:'7px 10px', borderRadius:6, border:'none', cursor:'pointer',
                            background: sortBy===val ? 'var(--brand-light)' : 'transparent',
                            color: sortBy===val ? 'var(--brand)' : 'var(--text-primary)',
                            fontSize:13, fontWeight: sortBy===val ? 600 : 400, textAlign:'left',
                          }}>
                            {label}
                            {sortBy===val && <span style={{fontSize:10}}>{sortDir==='asc'?'↑':'↓'}</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 px-4 py-1.5 border-b text-xs font-semibold text-gray-400 uppercase tracking-wide sticky top-0 z-10"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="w-8 flex-shrink-0"/>
            <div className="flex-1">Task name</div>
            <div className="w-36 pl-2 hidden md:block">Assignee</div>
            <div className="w-24 text-center hidden md:block">Due date</div>
            <div className="w-24 text-center hidden lg:block">Priority</div>
            <div className="w-28 text-center hidden lg:block">Status</div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {SECTIONS.map(section => {
              if (section.tasks.length === 0 && !section.creator) return null
              const isCollapsed = collapsed[section.key]
              return (
                <div key={section.key}>
                  <button onClick={() => setCollapsed(p => ({ ...p, [section.key]: !p[section.key] }))}
                    className="section-header w-full text-left hover:opacity-80 transition-opacity" style={{ color: section.color }}>
                    <span className="transition-transform inline-block" style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'none' }}>▾</span>
                    {section.label} <span className="opacity-40 font-normal normal-case text-xs">({section.tasks.length})</span>
                  </button>
                  {!isCollapsed && (
                    <>{section.tasks.map(t => <TaskRow key={t.id} task={t}/>)}
                      {section.creator && canManage && (
                        <InlineTaskRow projectId={project.id} defaultClientId={defaultClientId} members={members} clients={clients}
                          currentUserId={currentUserId} defaultStatus="todo" onCreated={() => startT(() => router.refresh())}/>
                      )}</>
                  )}
                </div>
              )
            })}
            {/* Add section */}
            {addSectionOpen ? (
              <div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 16px',
                borderTop:'1px solid var(--border)',background:'var(--brand-light)'}}>
                <Plus style={{width:14,height:14,color:'var(--brand)',flexShrink:0}}/>
                <input
                  value={newSectionName}
                  onChange={e=>setNewSectionName(e.target.value)}
                  onKeyDown={e=>{
                    if(e.key==='Enter' && newSectionName.trim()){
                      const key = 'custom_'+Date.now()
                      setCustomSections(p=>[...p,{key,label:newSectionName.trim(),color:'var(--text-secondary)'}])
                      setNewSectionName('')
                      setAddSectionOpen(false)
                    }
                    if(e.key==='Escape'){setAddSectionOpen(false);setNewSectionName('')}
                  }}
                  placeholder="Section name… (Enter to add)"
                  autoFocus
                  style={{flex:1,padding:'5px 8px',borderRadius:6,border:'1px solid var(--brand)',
                    outline:'none',fontSize:13,background:'var(--surface)',color:'var(--text-primary)'}}
                />
                <button onClick={()=>{
                  if(newSectionName.trim()){
                    const key='custom_'+Date.now()
                    setCustomSections(p=>[...p,{key,label:newSectionName.trim(),color:'var(--text-secondary)'}])
                    setNewSectionName('')
                  }
                  setAddSectionOpen(false)
                }} style={{padding:'5px 12px',borderRadius:6,border:'none',background:'var(--brand)',
                  color:'#fff',fontSize:12,fontWeight:600,cursor:'pointer'}}>
                  Add
                </button>
                <button onClick={()=>{setAddSectionOpen(false);setNewSectionName('')}}
                  style={{padding:'5px 8px',borderRadius:6,border:'none',background:'transparent',
                    color:'var(--text-muted)',fontSize:12,cursor:'pointer'}}>
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={()=>setAddSectionOpen(true)}
                style={{display:'flex',alignItems:'center',gap:8,padding:'10px 16px',
                  fontSize:13,color:'var(--text-muted)',background:'transparent',border:'none',
                  cursor:'pointer',width:'100%',textAlign:'left',transition:'color 0.1s'}}
                onMouseEnter={e=>(e.currentTarget.style.color='var(--brand)')}
                onMouseLeave={e=>(e.currentTarget.style.color='var(--text-muted)')}>
                <Plus style={{width:14,height:14}}/> Add section
              </button>
            )}
          </div>
        </div>
      )}

      {/* BOARD view */}
      {tab === 'board' && (
        <div className="flex-1 overflow-x-auto p-4" style={{ background: 'var(--surface-subtle)' }}>
          <div className="flex gap-4 h-full min-w-max">
            {BOARD_COLS.map(col => {
              const colTasks = tasks.filter(t => t.status === col.status)
              return (
                <div key={col.status} className="kanban-col">
                  <div className="flex items-center gap-2 px-3 py-2.5 border-b" style={{ borderColor: 'var(--border)' }}>
                    <div className="h-2.5 w-2.5 rounded-full" style={{ background: col.color }}/>
                    <span className="text-sm font-semibold text-gray-700">{col.label}</span>
                    <span className="text-xs text-gray-400 ml-auto">{colTasks.length}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {colTasks.map(task => {
                      const assignee = task.assignee as unknown as { id: string; name: string } | null
                      const pri      = PRIORITY_CONFIG[task.priority]
                      return (
                        <div key={task.id} onClick={() => setSelectedTask(task)}
                          className={cn('bg-white rounded-xl p-3 cursor-pointer hover:shadow-md transition-all border', selectedTask?.id === task.id ? 'border-teal-400 shadow-md' : 'border-gray-100 shadow-sm')}>
                          <div className="flex items-start gap-2 mb-2">
                            <button onClick={e => toggleDone(task.id, task.status, e)}
                              className={cn('task-check mt-0.5 flex-shrink-0', task.status === 'completed' && 'done')}>
                              {task.status === 'completed' && <svg viewBox="0 0 16 16" fill="none" className="h-2.5 w-2.5"><path d="M13 4L6.5 11 3 7.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                            </button>
                            <p className={cn('text-sm font-medium leading-snug flex-1', task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-900')}>{task.title}</p>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-1.5">
                              <PriorityBadge priority={task.priority}/>
                              {task.due_date && <span className="text-xs text-gray-400">{fmtDate(task.due_date)}</span>}
                            </div>
                            {assignee && <Avatar name={assignee.name} size="xs"/>}
                          </div>
                        </div>
                      )
                    })}
                    {col.status === 'todo' && canManage && (
                      <InlineTaskRow projectId={project.id} defaultClientId={defaultClientId} members={members} clients={clients}
                        currentUserId={currentUserId} defaultStatus="todo" onCreated={() => startT(() => router.refresh())}/>
                    )}
                    {colTasks.length === 0 && col.status !== 'todo' && (
                      <div className="text-center py-8 text-xs text-gray-300">No tasks</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* OVERVIEW tab */}
      {tab === 'overview' && (
        <div className="flex-1 overflow-y-auto p-6" style={{ background: 'var(--surface-subtle)' }}>
          <div className="max-w-3xl mx-auto grid grid-cols-2 gap-5">
            {/* Progress ring */}
            <div className="card-elevated p-5 col-span-2">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Progress</h3>
              <div className="flex items-center gap-6">
                <div className="relative h-20 w-20 flex-shrink-0">
                  <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="30" fill="none" stroke="#f1f5f9" strokeWidth="10"/>
                    <circle cx="40" cy="40" r="30" fill="none" stroke={project.color} strokeWidth="10"
                      strokeDasharray={`${(progress/100)*188.5} 188.5`} strokeLinecap="round"/>
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-gray-900">{progress}%</span>
                </div>
                <div className="grid grid-cols-2 gap-4 flex-1">
                  <Stat label="Total tasks" value={total} color="#64748b"/>
                  <Stat label="Completed"   value={done}  color="#16a34a"/>
                  <Stat label="In progress" value={tasks.filter(t => t.status === 'in_progress').length} color={project.color}/>
                  <Stat label="Overdue"     value={tasks.filter(t => isOverdue(t.due_date, t.status)).length} color="#dc2626"/>
                </div>
              </div>
            </div>

            {/* Time tracking */}
            <div className="card-elevated p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2"><Clock className="h-4 w-4 text-gray-400"/> Time</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span className="text-gray-500">Total logged</span><span className="font-semibold text-gray-900">{fmtHours(totalHours)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Billable</span><span className="font-semibold text-green-600">{fmtHours(billableHours)}</span></div>
                {project.hours_budget && <div className="flex justify-between text-sm"><span className="text-gray-500">Budget</span><span className="font-semibold text-gray-700">{project.hours_budget}h</span></div>}
              </div>
            </div>

            {/* Description */}
            <div className="card-elevated p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Description</h3>
              {project.description ? (
                <p className="text-sm text-gray-600 leading-relaxed">{project.description}</p>
              ) : <p className="text-sm text-gray-400 italic">No description added.</p>}
              {project.due_date && <p className="text-xs text-gray-400 mt-3">Due: {fmtDate(project.due_date, { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
            </div>
          </div>
        </div>
      )}

      <TaskDetailPanel task={selectedTask} members={members} clients={clients}
        currentUserId={currentUserId} userRole={userRole}
        onClose={() => setSelectedTask(null)} onUpdated={() => startT(() => router.refresh())}/>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div><p className="text-xs text-gray-400">{label}</p><p className="text-xl font-bold" style={{ color }}>{value}</p></div>
  )
}
