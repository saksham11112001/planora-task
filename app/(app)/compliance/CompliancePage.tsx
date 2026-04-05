'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Search, X, RotateCcw, Pencil, Check, ChevronDown, ChevronRight,
  FileCheck, Info, Paperclip, Plus, Trash2, ShieldCheck, TrendingUp, Lock,
} from 'lucide-react'
import {
  COMPLIANCE_TASKS, COMPLIANCE_GROUPS,
  type ComplianceTask, type ComplianceFrequency,
} from '@/lib/data/complianceTasks'
import {
  COMPLIANCE_FREQUENCIES, getFreqLabel, getFreqColor,
  type AttachmentConfig, type TaskOverride, type OrgOverrides, type CustomTask,
} from '@/lib/compliance'
import { useOrgSettings } from '@/lib/hooks/useOrgSettings'

/* ─── Constants ──────────────────────────────────────────────── */

const GROUP_COLORS: Record<string, string> = {
  'GST':               '#1B5E20',
  'TDS / TCS':         '#0D47A1',
  'Income Tax':        '#4A148C',
  'ROC / Company Law': '#BF360C',
  'Accounting & MIS':  '#006064',
  'Audit':             '#37474F',
  'Labour & Payroll':  '#E65100',
  'NGO / FCRA':        '#880E4F',
  'Other':             '#455A64',
}

const PRI_COLORS: Record<string, { bg: string; color: string }> = {
  high:  { bg:'#fef2f2', color:'#dc2626' },
  medium:{ bg:'#fffbeb', color:'#ca8a04' },
  low:   { bg:'#f0fdf4', color:'#16a34a' },
}

/* ─── Types (re-exported from @/lib/compliance for convenience) ─ */
export type { AttachmentConfig, TaskOverride, OrgOverrides }

function taskDefaults(t: ComplianceTask): TaskOverride {
  return {
    title:       t.title,
    frequency:   t.frequency,
    priority:    t.priority,
    description: t.description ?? '',
    attachments: t.subtasks.map(s => ({ name: s.title })),
  }
}

/* ─── Component ──────────────────────────────────────────────── */

const BLANK_CUSTOM: Omit<CustomTask,'_id'> = {
  title:'', group:'GST', category:'', frequency:'monthly', priority:'high', description:'', attachments:[],
}

export function CompliancePage() {
  const { caComplianceMode, loading: settingsLoading } = useOrgSettings()

  const [search,         setSearch]         = useState('')
  const [activeGroup,    setActiveGroup]    = useState('All')
  const [savedTab,       setSavedTab]       = useState<'saved' | 'pending'>('pending')
  const [overrides,      setOverrides]      = useState<OrgOverrides>({})
  const [customTasks,    setCustomTasks]    = useState<CustomTask[]>([])
  const [editingKey,     setEditingKey]     = useState<string | null>(null)
  const [draft,          setDraft]          = useState<TaskOverride | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(COMPLIANCE_GROUPS))
  const [showInfo,       setShowInfo]       = useState<string | null>(null)
  const [showAddTask,    setShowAddTask]    = useState(false)
  const [newTask,        setNewTask]        = useState<Omit<CustomTask,'_id'>>(BLANK_CUSTOM)
  const [dataLoading,    setDataLoading]    = useState(true)

  // Load overrides + custom tasks from org-scoped API (not localStorage)
  useEffect(() => {
    if (!caComplianceMode && !settingsLoading) return
    Promise.all([
      fetch('/api/compliance/overrides').then(r => r.json()).catch(() => ({ data: {} })),
      fetch('/api/compliance/custom').then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([ov, ct]) => {
      setOverrides(ov.data ?? {})
      setCustomTasks(ct.data ?? [])
      setDataLoading(false)
    })
  }, [caComplianceMode, settingsLoading])

  const saveOverridesApi = useCallback(async (updated: OrgOverrides) => {
    setOverrides(updated)
    await fetch('/api/compliance/overrides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overrides: updated }),
    })
  }, [])

  const saveCustomTasksApi = useCallback(async (updated: CustomTask[]) => {
    setCustomTasks(updated)
    await fetch('/api/compliance/custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks: updated }),
    })
  }, [])

  function effective(t: ComplianceTask): TaskOverride {
    return overrides[t.title] ?? taskDefaults(t)
  }

  const filteredTasks = useMemo(() => {
    const q = search.toLowerCase().trim()
    return COMPLIANCE_TASKS.filter(t => {
      if (activeGroup !== 'All' && t.group !== activeGroup) return false
      if (savedTab === 'saved' && !overrides[t.title]) return false
      if (savedTab === 'pending' && !!overrides[t.title]) return false
      if (!q) return true
      return (
        t.title.toLowerCase().includes(q) ||
        t.group.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q)
      )
    })
  }, [search, activeGroup, savedTab, overrides])

  const groupedTasks = useMemo(() => {
    const map: Record<string, ComplianceTask[]> = {}
    for (const t of filteredTasks) {
      if (!map[t.group]) map[t.group] = []
      map[t.group].push(t)
    }
    return map
  }, [filteredTasks])

  const orderedGroups = COMPLIANCE_GROUPS.filter(g => groupedTasks[g]?.length)

  /* ── Edit helpers ── */
  function startEdit(t: ComplianceTask) {
    setEditingKey(t.title)
    setDraft({ ...effective(t) })
    setShowInfo(null)
  }
  function cancelEdit() { setEditingKey(null); setDraft(null) }
  function saveEdit() {
    if (!editingKey || !draft) return
    const updated = { ...overrides, [editingKey]: draft }
    saveOverridesApi(updated)
    setEditingKey(null); setDraft(null)
  }
  function resetAll() { saveOverridesApi({}); cancelEdit() }
  function resetOne(key: string) {
    const updated = { ...overrides }; delete updated[key]
    saveOverridesApi(updated)
    if (editingKey === key) cancelEdit()
  }
  function addCustomTask() {
    if (!newTask.title.trim()) return
    const task: CustomTask = { ...newTask, _id: crypto.randomUUID(), title: newTask.title.trim() }
    const updated = [...customTasks, task]
    saveCustomTasksApi(updated)
    setNewTask(BLANK_CUSTOM); setShowAddTask(false)
  }
  function deleteCustomTask(id: string) {
    const updated = customTasks.filter(t => t._id !== id)
    saveCustomTasksApi(updated)
  }

  /* ── Attachment helpers (inside draft) ── */
  function setAttachmentCount(n: number, task: ComplianceTask) {
    if (!draft) return
    const cur  = draft.attachments
    const dflt = task.subtasks.map(s => ({ name: s.title }))
    let next: AttachmentConfig[]
    if (n === 0) {
      next = []
    } else if (n > cur.length) {
      const fill = dflt.slice(cur.length, n).concat(
        Array(Math.max(0, n - Math.max(cur.length, dflt.length))).fill({ name: '' })
      )
      next = [...cur, ...fill].slice(0, n)
    } else {
      next = cur.slice(0, n)
    }
    setDraft(d => d ? { ...d, attachments: next } : d)
  }
  function setAttachmentName(i: number, name: string) {
    setDraft(d => {
      if (!d) return d
      const atts = [...d.attachments]
      atts[i] = { name }
      return { ...d, attachments: atts }
    })
  }
  function addAttachment() {
    setDraft(d => d ? { ...d, attachments: [...d.attachments, { name: '' }] } : d)
  }
  function removeAttachment(i: number) {
    setDraft(d => {
      if (!d) return d
      const atts = [...d.attachments]; atts.splice(i, 1)
      return { ...d, attachments: atts }
    })
  }

  const overrideCount = Object.keys(overrides).length + customTasks.length
  const totalAttachments = COMPLIANCE_TASKS.reduce((acc, t) => acc + effective(t).attachments.length, 0)
    + customTasks.reduce((acc, t) => acc + t.attachments.length, 0)

  /* ── Coverage stats ── */
  const coverageStats = COMPLIANCE_GROUPS.map(g => ({
    group: g,
    count: COMPLIANCE_TASKS.filter(t => t.group === g).length,
    color: GROUP_COLORS[g],
  }))

  /* ───────────────────── RENDER ───────────────────────────────── */

  // Feature not enabled for this org
  if (!settingsLoading && !caComplianceMode) {
    return (
      <div className="page-container">
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          minHeight:420, gap:16, textAlign:'center', padding:32 }}>
          <div style={{ width:56, height:56, borderRadius:16, background:'#f1f5f9',
            display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Lock style={{ width:28, height:28, color:'#94a3b8' }}/>
          </div>
          <div>
            <h2 style={{ fontSize:20, fontWeight:700, color:'var(--text-primary)', marginBottom:6 }}>
              CA Compliance is not enabled
            </h2>
            <p style={{ fontSize:14, color:'var(--text-muted)', maxWidth:380, lineHeight:1.6 }}>
              Enable <strong>CA Compliance mode</strong> in{' '}
              <a href="/settings/features" style={{ color:'var(--brand)', textDecoration:'underline' }}>
                Settings → Features
              </a>{' '}
              to access this page.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (settingsLoading || dataLoading) {
    return (
      <div className="page-container">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:300 }}>
          <div style={{ width:28, height:28, border:'3px solid var(--brand)', borderTopColor:'transparent',
            borderRadius:'50%', animation:'spin 0.7s linear infinite' }}/>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="content-max" style={{ maxWidth: 1100 }}>

        {/* ── Hero Header ─────────────────────────────────────── */}
        <div style={{ background:'linear-gradient(135deg,#0f172a 0%,#134e4a 60%,#0d9488 100%)',
          borderRadius:16, padding:'28px 32px', marginBottom:24, position:'relative', overflow:'hidden' }}>
          {/* Background decoration */}
          <div style={{ position:'absolute', right:-40, top:-40, width:200, height:200,
            borderRadius:'50%', background:'rgba(255,255,255,0.04)', pointerEvents:'none' }}/>
          <div style={{ position:'absolute', right:60, bottom:-60, width:140, height:140,
            borderRadius:'50%', background:'rgba(255,255,255,0.03)', pointerEvents:'none' }}/>

          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:24 }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                <div style={{ width:40, height:40, borderRadius:11, background:'rgba(255,255,255,0.15)',
                  display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <FileCheck style={{ width:20, height:20, color:'#fff' }}/>
                </div>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <h1 style={{ fontSize:22, fontWeight:800, color:'#fff', margin:0 }}>CA Compliance Hub</h1>
                    <span style={{ fontSize:10, fontWeight:700, color:'#0d9488', background:'rgba(13,148,136,0.25)',
                      padding:'3px 8px', borderRadius:99, border:'1px solid rgba(13,148,136,0.4)' }}>
                      FOR CA FIRMS
                    </span>
                  </div>
                  <p style={{ fontSize:13, color:'rgba(255,255,255,0.6)', margin:0 }}>
                    {COMPLIANCE_TASKS.length} task templates across GST, TDS, Income Tax, ROC, Audit &amp; more
                  </p>
                </div>
              </div>
              <p style={{ fontSize:12, color:'rgba(255,255,255,0.5)', margin:0, maxWidth:520, lineHeight:1.6 }}>
                Customise task names, frequencies, priorities and define exactly which client documents &amp;
                attachments are required for each compliance — then assign them in bulk during client onboarding.
              </p>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8, alignItems:'flex-end', flexShrink:0 }}>
              <div style={{ display:'flex', gap:20 }}>
                {[
                  { icon: ShieldCheck, label:'Compliance areas', value: COMPLIANCE_GROUPS.length },
                  { icon: FileCheck,   label:'Task templates',   value: COMPLIANCE_TASKS.length },
                  { icon: Paperclip,   label:'Attachment slots', value: totalAttachments },
                  { icon: TrendingUp,  label:'Customised',       value: overrideCount },
                ].map(s => (
                  <div key={s.label} style={{ textAlign:'center' }}>
                    <div style={{ fontSize:22, fontWeight:800, color:'#fff' }}>{s.value}</div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.45)', whiteSpace:'nowrap' }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {overrideCount > 0 && (
                <button onClick={resetAll}
                  style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:7,
                    border:'1px solid rgba(255,255,255,0.2)', background:'rgba(255,255,255,0.07)',
                    color:'rgba(255,255,255,0.7)', fontSize:11, fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>
                  <RotateCcw style={{ width:11, height:11 }}/> Reset all customisations
                </button>
              )}
            </div>
          </div>

          {/* Coverage bar */}
          <div style={{ marginTop:20, display:'flex', gap:4, flexWrap:'wrap' }}>
            {coverageStats.map(s => (
              <div key={s.group} style={{ display:'flex', alignItems:'center', gap:5,
                padding:'4px 10px', borderRadius:99, background:'rgba(255,255,255,0.08)',
                border:'1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ width:6, height:6, borderRadius:2, background:s.color, flexShrink:0 }}/>
                <span style={{ fontSize:10, color:'rgba(255,255,255,0.6)', whiteSpace:'nowrap' }}>
                  {s.group} <strong style={{ color:'rgba(255,255,255,0.85)' }}>{s.count}</strong>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Search bar ───────────────────────────────────── */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12, flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flex:'1 1 220px', minWidth:180,
            padding:'8px 12px', borderRadius:9, border:'1px solid var(--border)', background:'var(--surface)' }}>
            <Search style={{ width:13, height:13, color:'var(--text-muted)', flexShrink:0 }}/>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search GST, TDS, ITR, ROC, Audit…"
              style={{ flex:1, border:'none', outline:'none', background:'transparent',
                fontSize:13, color:'var(--text-primary)', fontFamily:'inherit' }}/>
            {search && (
              <button onClick={() => setSearch('')} style={{ background:'none', border:'none', cursor:'pointer', padding:0 }}>
                <X style={{ width:12, height:12, color:'var(--text-muted)' }}/>
              </button>
            )}
          </div>
        </div>

        {/* ── Saved / Pending tabs ─────────────────────────── */}
        <div style={{ display:'flex', alignItems:'center', gap:0, marginBottom:16,
          borderBottom:'1px solid var(--border)' }}>
          {([
            { key: 'pending', label: 'Pending', desc: 'Not yet customised' },
            { key: 'saved',   label: 'Saved',   desc: 'Customised by your org' },
          ] as const).map(tab => {
            const isActive = savedTab === tab.key
            const count = tab.key === 'saved'
              ? COMPLIANCE_TASKS.filter(t => !!overrides[t.title]).length
              : COMPLIANCE_TASKS.filter(t => !overrides[t.title]).length
            return (
              <button key={tab.key} onClick={() => setSavedTab(tab.key)}
                style={{
                  padding:'9px 20px', fontSize:13, fontWeight: isActive ? 700 : 500,
                  border:'none', background:'transparent', cursor:'pointer',
                  borderBottom: isActive ? '2px solid var(--brand)' : '2px solid transparent',
                  color: isActive ? 'var(--brand)' : 'var(--text-muted)',
                  marginBottom:-1, fontFamily:'inherit',
                  display:'flex', alignItems:'center', gap:6,
                }}>
                {tab.label}
                <span style={{
                  fontSize:10, fontWeight:700, padding:'1px 7px', borderRadius:99,
                  background: isActive ? 'rgba(13,148,136,0.12)' : 'var(--surface-alt)',
                  color: isActive ? 'var(--brand)' : 'var(--text-muted)',
                }}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* ── Grid ─────────────────────────────────────────── */}
        {orderedGroups.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px 0', color:'var(--text-muted)' }}>
            <Search style={{ width:32, height:32, opacity:0.3, margin:'0 auto 12px', display:'block' }}/>
            <p style={{ fontSize:14 }}>No tasks match &ldquo;{search}&rdquo;</p>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {orderedGroups.map(group => {
              const tasks      = groupedTasks[group]
              const color      = GROUP_COLORS[group] ?? '#455A64'
              const isExpanded = expandedGroups.has(group)
              const customCount = tasks.filter(t => overrides[t.title]).length

              return (
                <div key={group} style={{ border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>

                  {/* Group header */}
                  <button
                    onClick={() => setExpandedGroups(prev => {
                      const n = new Set(prev)
                      if (n.has(group)) n.delete(group); else n.add(group)
                      return n
                    })}
                    style={{ width:'100%', display:'flex', alignItems:'center', gap:10,
                      padding:'12px 16px', background:color+'0E',
                      border:'none', borderBottom: isExpanded ? `1px solid ${color}22` : 'none',
                      cursor:'pointer', fontFamily:'inherit' }}>
                    <div style={{ width:10, height:10, borderRadius:3, background:color, flexShrink:0 }}/>
                    <span style={{ flex:1, fontSize:13, fontWeight:700, color:'var(--text-primary)', textAlign:'left' }}>
                      {group}
                    </span>
                    <span style={{ fontSize:11, color:'var(--text-muted)', marginRight:4 }}>
                      {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                    </span>
                    {customCount > 0 && (
                      <span style={{ fontSize:10, fontWeight:600, color:'#7c3aed',
                        background:'#f5f3ff', padding:'2px 8px', borderRadius:99, marginRight:4 }}>
                        {customCount} custom
                      </span>
                    )}
                    {isExpanded
                      ? <ChevronDown style={{ width:14, height:14, color:'var(--text-muted)' }}/>
                      : <ChevronRight style={{ width:14, height:14, color:'var(--text-muted)' }}/>}
                  </button>

                  {/* Column headers */}
                  {isExpanded && (
                    <>
                      <div style={{ display:'grid',
                        gridTemplateColumns:'1fr 110px 80px 90px 36px 96px',
                        gap:12, padding:'7px 16px',
                        background:'var(--surface-subtle)', borderBottom:'1px solid var(--border-light)' }}>
                        {['Task name','Frequency','Priority','Attachments','','Actions'].map(h => (
                          <span key={h} style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)',
                            textTransform:'uppercase', letterSpacing:'0.06em',
                            textAlign: h === 'Actions' ? 'right' : 'left' }}>
                            {h}
                          </span>
                        ))}
                      </div>

                      {/* Task rows */}
                      {tasks.map((task, idx) => {
                        const eff        = effective(task)
                        const isEditing  = editingKey === task.title
                        const isOverridden = !!overrides[task.title]
                        const isInfoOpen = showInfo === task.title
                        const isLast     = idx === tasks.length - 1

                        return (
                          <div key={task.title}>

                            {/* ── View / Edit row ── */}
                            <div style={{
                              display:'grid',
                              gridTemplateColumns:'1fr 110px 80px 90px 36px 96px',
                              gap:12, padding:'10px 16px', alignItems:'center',
                              borderBottom: isLast && !isInfoOpen && !isEditing ? 'none' : '1px solid var(--border-light)',
                              background: isEditing ? 'rgba(245,158,11,0.06)' : isOverridden ? 'rgba(124,58,237,0.025)' : 'var(--surface)',
                            }}>

                              {/* Task name */}
                              <div style={{ minWidth:0 }}>
                                {isEditing ? (
                                  <input value={draft?.title ?? ''}
                                    onChange={e => setDraft(d => d ? { ...d, title:e.target.value } : d)}
                                    style={{ width:'100%', padding:'5px 8px', borderRadius:6,
                                      border:'1.5px solid #f59e0b', outline:'none', fontSize:13,
                                      background:'var(--surface)', color:'var(--text-primary)', fontFamily:'inherit' }}/>
                                ) : (
                                  <div>
                                    <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                                      <span style={{ fontSize:13, fontWeight:500, color:'var(--text-primary)',
                                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                        {eff.title}
                                      </span>
                                      {isOverridden && (
                                        <span style={{ fontSize:9, fontWeight:700, color:'#7c3aed',
                                          background:'#f5f3ff', padding:'1px 6px', borderRadius:99, flexShrink:0 }}>
                                          CUSTOM
                                        </span>
                                      )}
                                    </div>
                                    <p style={{ fontSize:11, color:'var(--text-muted)', margin:'2px 0 0',
                                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                      {task.category}
                                    </p>
                                  </div>
                                )}
                              </div>

                              {/* Frequency */}
                              {isEditing ? (
                                <select value={draft?.frequency ?? 'monthly'}
                                  onChange={e => setDraft(d => d ? { ...d, frequency:e.target.value } : d)}
                                  style={{ padding:'5px 8px', borderRadius:6, border:'1.5px solid #f59e0b',
                                    outline:'none', fontSize:12, background:'var(--surface)', color:'var(--text-primary)', fontFamily:'inherit' }}>
                                  {(['Monthly','Quarterly','Annual','One-time'] as const).map(grp => (
                                    <optgroup key={grp} label={grp}>
                                      {COMPLIANCE_FREQUENCIES.filter(f => f.group === grp).map(f => (
                                        <option key={f.v} value={f.v}>{f.l}</option>
                                      ))}
                                    </optgroup>
                                  ))}
                                </select>
                              ) : (
                                <span style={{ fontSize:11, fontWeight:600, padding:'3px 8px', borderRadius:99,
                                  ...getFreqColor(eff.frequency), width:'fit-content', whiteSpace:'nowrap' }}>
                                  {getFreqLabel(eff.frequency)}
                                </span>
                              )}

                              {/* Priority */}
                              {isEditing ? (
                                <select value={draft?.priority}
                                  onChange={e => setDraft(d => d ? { ...d, priority:e.target.value as 'high'|'medium'|'low' } : d)}
                                  style={{ padding:'5px 8px', borderRadius:6, border:'1.5px solid #f59e0b',
                                    outline:'none', fontSize:12, background:'var(--surface)', color:'var(--text-primary)', fontFamily:'inherit' }}>
                                  <option value="high">High</option>
                                  <option value="medium">Medium</option>
                                  <option value="low">Low</option>
                                </select>
                              ) : (
                                <span style={{ fontSize:11, fontWeight:600, padding:'3px 8px', borderRadius:99,
                                  ...PRI_COLORS[eff.priority], textTransform:'capitalize', width:'fit-content' }}>
                                  {eff.priority}
                                </span>
                              )}

                              {/* Attachment count */}
                              <div>
                                {isEditing ? (
                                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                                    <select value={draft?.attachments.length ?? 0}
                                      onChange={e => setAttachmentCount(parseInt(e.target.value), task)}
                                      style={{ padding:'5px 8px', borderRadius:6, border:'1.5px solid #f59e0b',
                                        outline:'none', fontSize:12, background:'#fff', color:'var(--text-primary)', fontFamily:'inherit',
                                        width:'100%' }}>
                                      {[0,1,2,3,4,5,6].map(n => (
                                        <option key={n} value={n}>{n === 0 ? 'None' : n}</option>
                                      ))}
                                    </select>
                                  </div>
                                ) : (
                                  <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                                    <Paperclip style={{ width:11, height:11, color: eff.attachments.length > 0 ? '#0891b2' : 'var(--text-muted)' }}/>
                                    <span style={{ fontSize:12, fontWeight:600,
                                      color: eff.attachments.length > 0 ? '#0891b2' : 'var(--text-muted)' }}>
                                      {eff.attachments.length > 0 ? eff.attachments.length : '—'}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Info toggle */}
                              <button onClick={() => setShowInfo(isInfoOpen ? null : task.title)}
                                style={{ display:'flex', alignItems:'center', justifyContent:'center',
                                  width:28, height:28, borderRadius:6, border:'none',
                                  background: isInfoOpen ? 'rgba(13,148,136,0.12)' : 'transparent',
                                  color: isInfoOpen ? '#0d9488' : 'var(--text-muted)',
                                  cursor:'pointer' }}>
                                <Info style={{ width:13, height:13 }}/>
                              </button>

                              {/* Actions */}
                              <div style={{ display:'flex', alignItems:'center', gap:4, justifyContent:'flex-end' }}>
                                {isEditing ? (
                                  <>
                                    <button onClick={saveEdit}
                                      style={{ display:'flex', alignItems:'center', gap:3,
                                        padding:'5px 10px', borderRadius:6, border:'none',
                                        background:'#0d9488', color:'#fff',
                                        fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                                      <Check style={{ width:11, height:11 }}/> Save
                                    </button>
                                    <button onClick={cancelEdit}
                                      style={{ padding:'5px 8px', borderRadius:6,
                                        border:'1px solid var(--border)', background:'var(--surface)',
                                        color:'var(--text-muted)', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>
                                      <X style={{ width:11, height:11 }}/>
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button onClick={() => startEdit(task)}
                                      style={{ display:'flex', alignItems:'center', gap:4,
                                        padding:'5px 10px', borderRadius:6, border:'1px solid var(--border)',
                                        background:'var(--surface)', color:'var(--text-secondary)',
                                        fontSize:11, fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>
                                      <Pencil style={{ width:11, height:11 }}/> Edit
                                    </button>
                                    {isOverridden && (
                                      <button onClick={() => resetOne(task.title)} title="Reset to default"
                                        style={{ padding:'5px 7px', borderRadius:6, border:'1px solid var(--border)',
                                          background:'var(--surface)', color:'var(--text-muted)', cursor:'pointer', fontFamily:'inherit' }}>
                                        <RotateCcw style={{ width:10, height:10 }}/>
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>

                            {/* ── Expanded edit / info panel ── */}
                            {(isEditing || isInfoOpen) && (
                              <div style={{
                                padding:'14px 16px 16px',
                                background: isEditing ? 'rgba(245,158,11,0.05)' : 'var(--surface-subtle)',
                                borderBottom: isLast ? 'none' : '1px solid var(--border-light)',
                              }}>
                                {isEditing ? (
                                  <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

                                    {/* Description */}
                                    <div>
                                      <label style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)',
                                        display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.05em' }}>
                                        Notes / description
                                      </label>
                                      <textarea value={draft?.description ?? ''}
                                        onChange={e => setDraft(d => d ? { ...d, description:e.target.value } : d)}
                                        rows={2} placeholder="Internal note for your team about this compliance task…"
                                        style={{ width:'100%', padding:'7px 10px', borderRadius:7,
                                          border:'1.5px solid #f59e0b44', outline:'none', fontSize:12,
                                          background:'#fff', color:'var(--text-primary)', fontFamily:'inherit',
                                          resize:'vertical', lineHeight:1.5 }}/>
                                    </div>

                                    {/* ── Attachment Requirements ── */}
                                    <div style={{ borderTop:'1px solid rgba(245,158,11,0.2)', paddingTop:14 }}>
                                      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                                        <Paperclip style={{ width:13, height:13, color:'#0891b2' }}/>
                                        <span style={{ fontSize:11, fontWeight:700, color:'var(--text-primary)',
                                          textTransform:'uppercase', letterSpacing:'0.06em' }}>
                                          Required attachments
                                        </span>

                                        {/* Count selector */}
                                        <div style={{ display:'flex', alignItems:'center', gap:6, marginLeft:'auto' }}>
                                          <span style={{ fontSize:11, color:'var(--text-muted)' }}>Count:</span>
                                          <select value={draft?.attachments.length ?? 0}
                                            onChange={e => setAttachmentCount(parseInt(e.target.value), task)}
                                            style={{ padding:'4px 8px', borderRadius:6, border:'1.5px solid #f59e0b',
                                              outline:'none', fontSize:12, background:'var(--surface)', color:'var(--text-primary)', fontFamily:'inherit' }}>
                                            {[0,1,2,3,4,5,6].map(n => (
                                              <option key={n} value={n}>{n === 0 ? '0 — None' : n}</option>
                                            ))}
                                          </select>
                                          {(draft?.attachments.length === 0) && task.subtasks.length > 0 && (
                                            <button
                                              onClick={() => setDraft(d => d ? { ...d, attachments: task.subtasks.map(s => ({ name: s.title })) } : d)}
                                              style={{ fontSize:10, fontWeight:600, color:'#0d9488', background:'rgba(13,148,136,0.08)',
                                                border:'1px solid rgba(13,148,136,0.25)', padding:'3px 9px', borderRadius:6,
                                                cursor:'pointer', fontFamily:'inherit' }}>
                                              ↩ Use defaults
                                            </button>
                                          )}
                                        </div>
                                      </div>

                                      {/* Attachment name inputs */}
                                      {draft && draft.attachments.length > 0 && (
                                        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                                          {draft.attachments.map((att, i) => (
                                            <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
                                              <span style={{ width:20, height:20, borderRadius:5, flexShrink:0,
                                                background:'#0891b2', color:'#fff', fontSize:10, fontWeight:700,
                                                display:'flex', alignItems:'center', justifyContent:'center' }}>
                                                {i + 1}
                                              </span>
                                              <input
                                                value={att.name}
                                                onChange={e => setAttachmentName(i, e.target.value)}
                                                placeholder={`e.g. Computation sheet, Signed balance sheet…`}
                                                style={{ flex:1, padding:'7px 10px', borderRadius:7,
                                                  border:'1.5px solid var(--border)', outline:'none', fontSize:12,
                                                  background:'var(--surface)', color:'var(--text-primary)', fontFamily:'inherit' }}
                                                onFocus={e => (e.target.style.borderColor = '#f59e0b')}
                                                onBlur={e  => (e.target.style.borderColor = 'var(--border)')}
                                              />
                                              <button onClick={() => removeAttachment(i)}
                                                style={{ padding:'6px', borderRadius:6, border:'1px solid var(--border)',
                                                  background:'var(--surface)', color:'var(--text-muted)',
                                                  cursor:'pointer', display:'flex', alignItems:'center' }}>
                                                <Trash2 style={{ width:11, height:11 }}/>
                                              </button>
                                            </div>
                                          ))}
                                          {draft.attachments.length < 6 && (
                                            <button onClick={addAttachment}
                                              style={{ display:'flex', alignItems:'center', gap:5, alignSelf:'flex-start',
                                                padding:'5px 10px', borderRadius:6, border:'1px dashed #0891b244',
                                                background:'transparent', color:'#0891b2', fontSize:11,
                                                fontWeight:500, cursor:'pointer', fontFamily:'inherit', marginTop:2 }}>
                                              <Plus style={{ width:11, height:11 }}/> Add attachment
                                            </button>
                                          )}
                                        </div>
                                      )}
                                      {draft && draft.attachments.length === 0 && (
                                        <p style={{ fontSize:11, color:'var(--text-muted)', fontStyle:'italic' }}>
                                          No attachments required for this task. Select a count above to add some.
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  /* Info view */
                                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                                    <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                                      <Info style={{ width:13, height:13, color:'var(--text-muted)', marginTop:1, flexShrink:0 }}/>
                                      <div>
                                        <p style={{ fontSize:12, color:'var(--text-secondary)', margin:0, lineHeight:1.6 }}>
                                          {eff.description || task.description || 'No description.'}
                                        </p>
                                        <p style={{ fontSize:11, color:'var(--text-muted)', margin:'4px 0 0' }}>
                                          Category: <strong>{task.category}</strong>
                                        </p>
                                      </div>
                                    </div>
                                    {eff.attachments.length > 0 && (
                                      <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                                        <Paperclip style={{ width:13, height:13, color:'#0891b2', marginTop:2, flexShrink:0 }}/>
                                        <div>
                                          <p style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)',
                                            textTransform:'uppercase', letterSpacing:'0.05em', margin:'0 0 5px' }}>
                                            Required attachments ({eff.attachments.length})
                                          </p>
                                          <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                                            {eff.attachments.map((a, i) => (
                                              <span key={i} style={{ display:'flex', alignItems:'center', gap:5,
                                                fontSize:11, color:'var(--text-secondary)', background:'var(--surface)',
                                                border:'1px solid var(--border)', padding:'4px 10px', borderRadius:7 }}>
                                                <span style={{ width:16, height:16, borderRadius:4, background:'#0891b2',
                                                  color:'#fff', fontSize:9, fontWeight:700, display:'flex',
                                                  alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                                                  {i + 1}
                                                </span>
                                                {a.name || `Attachment ${i + 1}`}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Custom tasks (org additions) ─────────────── */}
        {customTasks.length > 0 && (
          <div style={{ border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', marginBottom:0 }}>
            <div style={{ padding:'10px 16px', background:'rgba(124,58,237,0.06)',
              borderBottom:'1px solid rgba(124,58,237,0.15)' }}>
              <span style={{ fontSize:13, fontWeight:700, color:'#7c3aed' }}>Custom tasks ({customTasks.length})</span>
              <span style={{ fontSize:11, color:'var(--text-muted)', marginLeft:8 }}>
                — added by your organisation
              </span>
            </div>
            {customTasks.map((ct, idx) => (
              <div key={ct._id} style={{ display:'grid', gridTemplateColumns:'1fr 110px 80px 90px 36px 96px',
                gap:12, padding:'10px 16px', alignItems:'center',
                borderBottom: idx === customTasks.length - 1 ? 'none' : '1px solid var(--border-light)',
                background:'var(--surface)' }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:500, color:'var(--text-primary)' }}>{ct.title}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:1 }}>{ct.category || ct.group}</div>
                </div>
                <span style={{ fontSize:11, fontWeight:600, padding:'3px 8px', borderRadius:99,
                  ...getFreqColor(ct.frequency), width:'fit-content', whiteSpace:'nowrap' }}>
                  {getFreqLabel(ct.frequency)}
                </span>
                <span style={{ fontSize:11, fontWeight:600, padding:'3px 8px', borderRadius:99,
                  ...PRI_COLORS[ct.priority], textTransform:'capitalize', width:'fit-content' }}>
                  {ct.priority}
                </span>
                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <Paperclip style={{ width:11, height:11, color: ct.attachments.length > 0 ? '#0891b2' : 'var(--text-muted)' }}/>
                  <span style={{ fontSize:12, fontWeight:600, color: ct.attachments.length > 0 ? '#0891b2' : 'var(--text-muted)' }}>
                    {ct.attachments.length > 0 ? ct.attachments.length : '—'}
                  </span>
                </div>
                <div/>
                <div style={{ display:'flex', justifyContent:'flex-end' }}>
                  <button onClick={() => deleteCustomTask(ct._id)}
                    style={{ display:'flex', alignItems:'center', gap:4, padding:'5px 8px', borderRadius:6,
                      border:'1px solid var(--border)', background:'var(--surface)', color:'#dc2626',
                      fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>
                    <Trash2 style={{ width:11, height:11 }}/> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Add custom task button/form ───────────────── */}
        {showAddTask ? (
          <div style={{ border:'1.5px dashed rgba(124,58,237,0.4)', borderRadius:12,
            padding:'16px', background:'rgba(124,58,237,0.03)' }}>
            <p style={{ fontSize:12, fontWeight:700, color:'#7c3aed', marginBottom:12 }}>New custom task</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 }}>
              <div style={{ gridColumn:'1/4' }}>
                <input value={newTask.title}
                  onChange={e => setNewTask(n => ({ ...n, title:e.target.value }))}
                  placeholder="Task name *"
                  style={{ width:'100%', padding:'7px 10px', borderRadius:7, border:'1.5px solid rgba(124,58,237,0.4)',
                    outline:'none', fontSize:13, background:'var(--surface)', color:'var(--text-primary)', fontFamily:'inherit' }}/>
              </div>
              <div>
                <label style={{ fontSize:10, fontWeight:600, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Group</label>
                <select value={newTask.group} onChange={e => setNewTask(n => ({ ...n, group:e.target.value }))}
                  style={{ width:'100%', padding:'6px 8px', borderRadius:7, border:'1px solid var(--border)',
                    fontSize:12, background:'var(--surface)', color:'var(--text-primary)', fontFamily:'inherit', outline:'none' }}>
                  {COMPLIANCE_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize:10, fontWeight:600, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Frequency</label>
                <select value={newTask.frequency} onChange={e => setNewTask(n => ({ ...n, frequency:e.target.value }))}
                  style={{ width:'100%', padding:'6px 8px', borderRadius:7, border:'1px solid var(--border)',
                    fontSize:12, background:'var(--surface)', color:'var(--text-primary)', fontFamily:'inherit', outline:'none' }}>
                  {(['Monthly','Quarterly','Annual','One-time'] as const).map(grp => (
                    <optgroup key={grp} label={grp}>
                      {COMPLIANCE_FREQUENCIES.filter(f => f.group === grp).map(f => (
                        <option key={f.v} value={f.v}>{f.l}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize:10, fontWeight:600, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Priority</label>
                <select value={newTask.priority} onChange={e => setNewTask(n => ({ ...n, priority:e.target.value as 'high'|'medium'|'low' }))}
                  style={{ width:'100%', padding:'6px 8px', borderRadius:7, border:'1px solid var(--border)',
                    fontSize:12, background:'var(--surface)', color:'var(--text-primary)', fontFamily:'inherit', outline:'none' }}>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={addCustomTask} disabled={!newTask.title.trim()}
                style={{ padding:'7px 16px', borderRadius:7, border:'none',
                  background: newTask.title.trim() ? '#7c3aed' : 'var(--border)',
                  color: newTask.title.trim() ? '#fff' : 'var(--text-muted)',
                  fontSize:12, fontWeight:600, cursor: newTask.title.trim() ? 'pointer' : 'not-allowed', fontFamily:'inherit' }}>
                <Check style={{ width:12, height:12, display:'inline', marginRight:4 }}/>Add task
              </button>
              <button onClick={() => { setShowAddTask(false); setNewTask(BLANK_CUSTOM) }}
                style={{ padding:'7px 12px', borderRadius:7, border:'1px solid var(--border)',
                  background:'var(--surface)', color:'var(--text-secondary)',
                  fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowAddTask(true)}
            style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'12px 16px',
              borderRadius:12, border:'1.5px dashed rgba(124,58,237,0.35)',
              background:'rgba(124,58,237,0.03)', color:'#7c3aed',
              fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
              justifyContent:'center', transition:'all 0.15s' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(124,58,237,0.08)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='rgba(124,58,237,0.03)'}>
            <Plus style={{ width:15, height:15 }}/> Add custom compliance task
          </button>
        )}

        {/* ── Footer ──────────────────────────────────────── */}
        <div style={{ marginTop:24, padding:'14px 18px', borderRadius:10,
          background:'var(--surface-subtle)', border:'1px solid var(--border-light)',
          display:'flex', alignItems:'flex-start', gap:10 }}>
          <ShieldCheck style={{ width:16, height:16, color:'#0d9488', marginTop:1, flexShrink:0 }}/>
          <div>
            <p style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', margin:'0 0 3px' }}>
              Built for CA firms
            </p>
            <p style={{ fontSize:12, color:'var(--text-muted)', margin:0, lineHeight:1.6 }}>
              Customise any template — task name, frequency, required attachments — and your settings persist
              for the whole organisation. When onboarding a new client, select tasks in bulk and each client
              gets their own recurring compliance schedule with the exact attachment checklist you&apos;ve defined.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
