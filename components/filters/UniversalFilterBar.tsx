'use client'
import React, { useState, useRef, useEffect } from 'react'
import { useFilterStore } from '@/store/appStore'
import { PRIORITY_CONFIG, STATUS_CONFIG } from '@/types'
import { MultiPillSelect, PILL, PILL_ACTIVE } from './MultiPillSelect'

function todayIso() { return new Date().toISOString().slice(0, 10) }
function addDays(n: number) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
function subDays(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }

const DUE_PRESETS = [
  { value: '1d',   label: 'Due today',    from: () => todayIso(), to: () => addDays(1)  },
  { value: '3d',   label: 'Due in 3d',   from: () => todayIso(), to: () => addDays(3)  },
  { value: '1w',   label: 'Due in 1w',   from: () => todayIso(), to: () => addDays(7)  },
  { value: '15d',  label: 'Due in 15d',  from: () => todayIso(), to: () => addDays(15) },
] as const

const PAST_PRESETS = [
  { value: 'today', label: 'Today',      from: () => todayIso(),  to: () => todayIso()  },
  { value: '7d',    label: 'Last 7d',    from: () => subDays(7),  to: () => todayIso()  },
  { value: '30d',   label: 'Last 30d',   from: () => subDays(30), to: () => todayIso()  },
  { value: '90d',   label: 'Last 90d',   from: () => subDays(90), to: () => todayIso()  },
] as const

interface Props {
  clients?:          { id: string; name: string; color: string }[]
  members?:          { id: string; name: string }[]
  showSearch?:       boolean
  showPriority?:     boolean
  showStatus?:       boolean
  showDueDate?:      boolean
  showAssignee?:     boolean
  showAssignor?:     boolean
  showCreatedDate?:  boolean
  showUpdatedDate?:  boolean
  className?:        string
}


export function UniversalFilterBar({
  clients = [], members = [],
  showSearch = false, showPriority = true, showStatus = true,
  showDueDate = false, showAssignee = false, showAssignor = false,
  showCreatedDate = false, showUpdatedDate = false,
}: Props) {
  const {
    search, clientId, priority, status, assigneeId, creatorId,
    dueDateFrom, dueDateTo, createdFrom, createdTo, updatedFrom, updatedTo,
    setFilter, resetFilters,
  } = useFilterStore()

  const [dateOpen, setDateOpen] = useState(false)
  const [alignDateRight, setAlignDateRight] = useState(false)
  const [duePreset, setDuePreset] = useState('')
  const [createdPreset, setCreatedPreset] = useState('')
  const [updatedPreset, setUpdatedPreset] = useState('')
  const [showCustomDue, setShowCustomDue] = useState(false)
  const [showCustomCreated, setShowCustomCreated] = useState(false)
  const [showCustomUpdated, setShowCustomUpdated] = useState(false)
  const dateRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dateOpen) return
    function h(e: MouseEvent) {
      if (dateRef.current && !dateRef.current.contains(e.target as Node)) setDateOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [dateOpen])

  const hasDateFilter = !!(duePreset || dueDateFrom || createdPreset || createdFrom || updatedPreset || updatedFrom)
  const showDate      = showDueDate || showCreatedDate || showUpdatedDate

  const activeDateLabel = duePreset
    ? DUE_PRESETS.find(p => p.value === duePreset)?.label ?? 'Due date'
    : dueDateFrom ? 'Due: custom'
    : createdPreset ? `Created: ${PAST_PRESETS.find(p => p.value === createdPreset)?.label ?? ''}`
    : createdFrom ? 'Created: custom'
    : updatedPreset ? `Modified: ${PAST_PRESETS.find(p => p.value === updatedPreset)?.label ?? ''}`
    : updatedFrom ? 'Modified: custom'
    : 'Date'

  function clearAllDates() {
    setDuePreset(''); setShowCustomDue(false); setFilter('dueDateFrom',''); setFilter('dueDateTo','')
    setCreatedPreset(''); setShowCustomCreated(false); setFilter('createdFrom',''); setFilter('createdTo','')
    setUpdatedPreset(''); setShowCustomUpdated(false); setFilter('updatedFrom',''); setFilter('updatedTo','')
  }

  const activeCount = [
    clientId.length > 0, priority.length > 0, status.length > 0,
    assigneeId.length > 0, creatorId.length > 0,
    !!(duePreset || dueDateFrom), !!(createdPreset || createdFrom),
    !!(updatedPreset || updatedFrom), !!search,
  ].filter(Boolean).length

  const priorityOpts = (Object.keys(PRIORITY_CONFIG) as string[])
    .filter(k => k !== 'none')
    .map(k => ({ value: k, label: PRIORITY_CONFIG[k as keyof typeof PRIORITY_CONFIG].label }))
  const statusOpts = (Object.keys(STATUS_CONFIG) as string[])
    .map(k => ({ value: k, label: STATUS_CONFIG[k as keyof typeof STATUS_CONFIG].label }))

  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 18px',
      borderBottom:'1px solid var(--border-light)', background:'var(--surface)',
      flexShrink:0, flexWrap:'wrap', position:'relative', zIndex:10 }}>

      {showSearch && (
        <div style={{ display:'flex', alignItems:'center', gap:6, background:'var(--surface-subtle)',
          border:'1px solid var(--border)', borderRadius:20, padding:'4px 10px',
          minWidth:160, flex:'1 1 160px', maxWidth:240 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            style={{ color:'var(--text-muted)', flexShrink:0 }}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input value={search} onChange={e => setFilter('search', e.target.value)} placeholder="Search…"
            style={{ flex:1, fontSize:12, border:'none', outline:'none',
              background:'transparent', color:'var(--text-primary)', fontFamily:'inherit' }}/>
          {search && (
            <button onClick={() => setFilter('search','')}
              style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:14, lineHeight:1, padding:0 }}>×</button>
          )}
        </div>
      )}

      {clients.length > 0 && (
        <MultiPillSelect values={clientId} onChange={v => setFilter('clientId', v)}
          placeholder="All clients" options={clients.map(c => ({ value: c.id, label: c.name }))}/>
      )}
      {showPriority && (
        <MultiPillSelect values={priority} onChange={v => setFilter('priority', v)}
          placeholder="All priorities" options={priorityOpts}/>
      )}
      {showStatus && (
        <MultiPillSelect values={status} onChange={v => setFilter('status', v)}
          placeholder="All statuses" options={statusOpts}/>
      )}
      {showAssignee && members.length > 0 && (
        <MultiPillSelect values={assigneeId} onChange={v => setFilter('assigneeId', v)}
          placeholder="All members" options={members.map(m => ({ value: m.id, label: m.name }))}/>
      )}
      {showAssignor && members.length > 0 && (
        <MultiPillSelect values={creatorId} onChange={v => setFilter('creatorId', v)}
          placeholder="Assigned by" options={members.map(m => ({ value: m.id, label: m.name }))}/>
      )}

      {/* Unified date filter */}
      {showDate && (
        <div ref={dateRef} style={{ position:'relative' }}>
          <button
            onClick={() => {
              if (!dateOpen && dateRef.current) {
                const r = dateRef.current.getBoundingClientRect()
                setAlignDateRight(r.left + 260 > window.innerWidth - 8)
              }
              setDateOpen(o => !o)
            }}
            style={{
              ...(hasDateFilter ? PILL_ACTIVE : PILL),
              paddingRight: hasDateFilter ? 28 : 10,
              gap: 5,
            }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ flexShrink:0 }}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            {activeDateLabel}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              style={{ flexShrink:0, opacity:0.6 }}>
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </button>
          {hasDateFilter && (
            <button onClick={e => { e.stopPropagation(); clearAllDates() }}
              style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)',
                width:14, height:14, borderRadius:'50%', border:'none', background:'var(--brand)',
                color:'#fff', fontSize:9, fontWeight:700, cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1, padding:0 }}
              title="Clear date filter">×</button>
          )}

          {dateOpen && (
            <div style={{ position:'absolute', top:'calc(100% + 6px)', ...(alignDateRight ? {right:0} : {left:0}), zIndex:1000,
              background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12,
              boxShadow:'0 10px 40px rgba(0,0,0,0.15)', padding:'10px 12px', minWidth:260 }}>

              {showDueDate && (
                <div style={{ marginBottom: showCreatedDate || showUpdatedDate ? 12 : 0 }}>
                  <p style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase',
                    letterSpacing:'0.07em', marginBottom:6 }}>Due date</p>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                    {DUE_PRESETS.map(p => (
                      <button key={p.value}
                        onClick={() => {
                          if (duePreset === p.value) { setDuePreset(''); setFilter('dueDateFrom',''); setFilter('dueDateTo','') }
                          else { setDuePreset(p.value); setFilter('dueDateFrom',p.from()); setFilter('dueDateTo',p.to()); setShowCustomDue(false) }
                        }}
                        style={{ fontSize:11, padding:'3px 10px', borderRadius:99, border:'none', cursor:'pointer',
                          fontFamily:'inherit', fontWeight: duePreset===p.value ? 700 : 400,
                          background: duePreset===p.value ? 'var(--brand)' : 'var(--surface-subtle)',
                          color: duePreset===p.value ? '#fff' : 'var(--text-secondary)' }}>
                        {p.label}
                      </button>
                    ))}
                    <button
                      onClick={() => { setShowCustomDue(o => !o); setDuePreset('') }}
                      style={{ fontSize:11, padding:'3px 10px', borderRadius:99, border:'none', cursor:'pointer',
                        fontFamily:'inherit', fontWeight: showCustomDue ? 700 : 400,
                        background: showCustomDue ? 'rgba(13,148,136,0.15)' : 'var(--surface-subtle)',
                        color: showCustomDue ? 'var(--brand)' : 'var(--text-secondary)' }}>
                      Custom…
                    </button>
                  </div>
                  {showCustomDue && (
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:6 }}>
                      <input type="date" value={dueDateFrom} onChange={e => setFilter('dueDateFrom',e.target.value)}
                        style={{ fontSize:11, padding:'3px 8px', borderRadius:6, border:'1px solid var(--border)',
                          background:'var(--surface-subtle)', color:'var(--text-primary)', fontFamily:'inherit', colorScheme:'light dark' }}/>
                      <span style={{ fontSize:11, color:'var(--text-muted)' }}>–</span>
                      <input type="date" value={dueDateTo} onChange={e => setFilter('dueDateTo',e.target.value)}
                        style={{ fontSize:11, padding:'3px 8px', borderRadius:6, border:'1px solid var(--border)',
                          background:'var(--surface-subtle)', color:'var(--text-primary)', fontFamily:'inherit', colorScheme:'light dark' }}/>
                    </div>
                  )}
                </div>
              )}

              {showCreatedDate && (
                <div style={{ marginBottom: showUpdatedDate ? 12 : 0,
                  borderTop: showDueDate ? '1px solid var(--border-light)' : 'none',
                  paddingTop: showDueDate ? 12 : 0 }}>
                  <p style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase',
                    letterSpacing:'0.07em', marginBottom:6 }}>Created date</p>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                    {PAST_PRESETS.map(p => (
                      <button key={p.value}
                        onClick={() => {
                          if (createdPreset === p.value) { setCreatedPreset(''); setFilter('createdFrom',''); setFilter('createdTo','') }
                          else { setCreatedPreset(p.value); setFilter('createdFrom',p.from()); setFilter('createdTo',p.to()); setShowCustomCreated(false) }
                        }}
                        style={{ fontSize:11, padding:'3px 10px', borderRadius:99, border:'none', cursor:'pointer',
                          fontFamily:'inherit', fontWeight: createdPreset===p.value ? 700 : 400,
                          background: createdPreset===p.value ? 'var(--brand)' : 'var(--surface-subtle)',
                          color: createdPreset===p.value ? '#fff' : 'var(--text-secondary)' }}>
                        {p.label}
                      </button>
                    ))}
                    <button onClick={() => { setShowCustomCreated(o => !o); setCreatedPreset('') }}
                      style={{ fontSize:11, padding:'3px 10px', borderRadius:99, border:'none', cursor:'pointer',
                        fontFamily:'inherit', fontWeight: showCustomCreated ? 700 : 400,
                        background: showCustomCreated ? 'rgba(13,148,136,0.15)' : 'var(--surface-subtle)',
                        color: showCustomCreated ? 'var(--brand)' : 'var(--text-secondary)' }}>Custom…</button>
                  </div>
                  {showCustomCreated && (
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:6 }}>
                      <input type="date" value={createdFrom} onChange={e => setFilter('createdFrom',e.target.value)}
                        style={{ fontSize:11, padding:'3px 8px', borderRadius:6, border:'1px solid var(--border)',
                          background:'var(--surface-subtle)', color:'var(--text-primary)', fontFamily:'inherit', colorScheme:'light dark' }}/>
                      <span style={{ fontSize:11, color:'var(--text-muted)' }}>–</span>
                      <input type="date" value={createdTo} onChange={e => setFilter('createdTo',e.target.value)}
                        style={{ fontSize:11, padding:'3px 8px', borderRadius:6, border:'1px solid var(--border)',
                          background:'var(--surface-subtle)', color:'var(--text-primary)', fontFamily:'inherit', colorScheme:'light dark' }}/>
                    </div>
                  )}
                </div>
              )}

              {showUpdatedDate && (
                <div style={{
                  borderTop: (showDueDate || showCreatedDate) ? '1px solid var(--border-light)' : 'none',
                  paddingTop: (showDueDate || showCreatedDate) ? 12 : 0 }}>
                  <p style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase',
                    letterSpacing:'0.07em', marginBottom:6 }}>Modified date</p>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                    {PAST_PRESETS.map(p => (
                      <button key={p.value}
                        onClick={() => {
                          if (updatedPreset === p.value) { setUpdatedPreset(''); setFilter('updatedFrom',''); setFilter('updatedTo','') }
                          else { setUpdatedPreset(p.value); setFilter('updatedFrom',p.from()); setFilter('updatedTo',p.to()); setShowCustomUpdated(false) }
                        }}
                        style={{ fontSize:11, padding:'3px 10px', borderRadius:99, border:'none', cursor:'pointer',
                          fontFamily:'inherit', fontWeight: updatedPreset===p.value ? 700 : 400,
                          background: updatedPreset===p.value ? 'var(--brand)' : 'var(--surface-subtle)',
                          color: updatedPreset===p.value ? '#fff' : 'var(--text-secondary)' }}>
                        {p.label}
                      </button>
                    ))}
                    <button onClick={() => { setShowCustomUpdated(o => !o); setUpdatedPreset('') }}
                      style={{ fontSize:11, padding:'3px 10px', borderRadius:99, border:'none', cursor:'pointer',
                        fontFamily:'inherit', fontWeight: showCustomUpdated ? 700 : 400,
                        background: showCustomUpdated ? 'rgba(13,148,136,0.15)' : 'var(--surface-subtle)',
                        color: showCustomUpdated ? 'var(--brand)' : 'var(--text-secondary)' }}>Custom…</button>
                  </div>
                  {showCustomUpdated && (
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:6 }}>
                      <input type="date" value={updatedFrom} onChange={e => setFilter('updatedFrom',e.target.value)}
                        style={{ fontSize:11, padding:'3px 8px', borderRadius:6, border:'1px solid var(--border)',
                          background:'var(--surface-subtle)', color:'var(--text-primary)', fontFamily:'inherit', colorScheme:'light dark' }}/>
                      <span style={{ fontSize:11, color:'var(--text-muted)' }}>–</span>
                      <input type="date" value={updatedTo} onChange={e => setFilter('updatedTo',e.target.value)}
                        style={{ fontSize:11, padding:'3px 8px', borderRadius:6, border:'1px solid var(--border)',
                          background:'var(--surface-subtle)', color:'var(--text-primary)', fontFamily:'inherit', colorScheme:'light dark' }}/>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeCount > 0 && (
        <button
          onClick={() => {
            resetFilters()
            clearAllDates()
          }}
          style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:5, padding:'4px 10px',
            borderRadius:20, fontSize:11, fontWeight:600, border:'1px solid #dc2626',
            background:'rgba(220,38,38,0.06)', color:'#dc2626', cursor:'pointer', whiteSpace:'nowrap' as any }}>
          <span style={{ fontSize:10 }}>✕</span>
          Clear all
          <span style={{ background:'#dc2626', color:'#fff', borderRadius:'50%',
            width:16, height:16, display:'inline-flex', alignItems:'center',
            justifyContent:'center', fontSize:10, fontWeight:700 }}>{activeCount}</span>
        </button>
      )}
    </div>
  )
}
