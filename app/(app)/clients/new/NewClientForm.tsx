'use client'
import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/store/appStore'
import {
  ChevronRight, ChevronDown, Search, X, Check,
  FileCheck, Building2, Calendar, Paperclip, ShieldCheck, User, Shield, Bell, Loader2,
} from 'lucide-react'
import {
  COMPLIANCE_TASKS, COMPLIANCE_GROUPS,
  type ComplianceTask,
} from '@/lib/data/complianceTasks'
import {
  COMPLIANCE_FREQUENCIES, getFreqLabel,
  type AttachmentConfig, type OrgOverrides,
} from '@/lib/compliance'
import { useOrgSettings } from '@/lib/hooks/useOrgSettings'

/* ─── Constants ──────────────────────────────────────────────── */

const COLORS = ['#0d9488','#7c3aed','#dc2626','#ca8a04','#16a34a','#0891b2','#db2777','#4f46e5','#ea580c','#374151']

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

/* ─── Types ──────────────────────────────────────────────────── */

interface Member { id: string; name: string; role?: string }

interface TaskSelection {
  selected:      boolean
  frequency:     string
  startDate:     string
  endDate:       string
  assigneeId:    string
  approverId:    string
  daysBeforeDue: string
}

type SelectionMap = Record<string, TaskSelection>

function defaultSelection(t: ComplianceTask): TaskSelection {
  const year = new Date().getFullYear()
  return {
    selected:      false,
    frequency:     t.frequency,
    startDate:     `${year}-04-01`,
    endDate:       `${year + 1}-03-31`,
    assigneeId:    '',
    approverId:    '',
    daysBeforeDue: '',
  }
}

function getAttachments(task: ComplianceTask, overrides: OrgOverrides): AttachmentConfig[] {
  const ov = overrides[task.title]
  if (ov?.attachments?.length) return ov.attachments
  return task.subtasks.map(s => ({ name: s.title }))
}

/* ─── Component ──────────────────────────────────────────────── */

export function NewClientForm({ members = [] }: { members?: Member[] }) {
  const router = useRouter()
  const { caComplianceMode } = useOrgSettings()
  const [step,       setStep]       = useState<1 | 2>(1)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')
  const [orgOverrides, setOrgOverrides] = useState<OrgOverrides>({})

  // Load org-scoped overrides from API (used when creating compliance tasks)
  useEffect(() => {
    if (!caComplianceMode) return
    fetch('/api/compliance/overrides')
      .then(r => r.json())
      .then(d => setOrgOverrides(d.data ?? {}))
      .catch(() => {})
  }, [caComplianceMode])

  /* GST lookup */
  const [gstin,        setGstin]        = useState('')
  const [gstLooking,   setGstLooking]   = useState(false)
  const [gstInfo,      setGstInfo]      = useState<null | {
    pan?: string; state?: string; gst_status?: string | null; constitution?: string | null;
    registration_date?: string | null; partial?: boolean; message?: string
  }>(null)
  const gstInputRef = useRef<HTMLInputElement>(null)

  /* Step 1 */
  const [form, setForm] = useState({
    name:'', email:'', phone:'', company:'', website:'',
    industry:'', notes:'', status:'active', color:'#0d9488',
  })

  /* Step 2 */
  const [selection, setSelection] = useState<SelectionMap>(() =>
    Object.fromEntries(COMPLIANCE_TASKS.map(t => [t.title, defaultSelection(t)]))
  )
  const [compSearch,     setCompSearch]     = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['GST']))
  const [expandedTasks,  setExpandedTasks]  = useState<Set<string>>(new Set())

  const approvers = members.filter(m => m.role && ['owner','admin','manager'].includes(m.role))

  function setField(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function lookupGSTIN(raw: string) {
    const g = raw.trim().toUpperCase()
    if (g.length !== 15) return
    setGstLooking(true)
    setGstInfo(null)
    try {
      const res  = await fetch(`/api/gst/lookup?gstin=${encodeURIComponent(g)}`)
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'GST lookup failed'); return }
      const d = json.data
      // Auto-fill form fields
      setForm(f => ({
        ...f,
        name:    d.name    ?? f.name,
        company: d.name    ?? f.company,
        industry:d.nature_of_business ?? d.constitution ?? f.industry,
        notes:   f.notes ? f.notes : [
          d.gst_status      ? `GST Status: ${d.gst_status}`       : null,
          d.state           ? `State: ${d.state}`                  : null,
          d.constitution    ? `Entity: ${d.constitution}`          : null,
          d.registration_date ? `GST Reg: ${d.registration_date}` : null,
        ].filter(Boolean).join('\n'),
      }))
      setGstInfo({
        pan:               d.pan,
        state:             d.state,
        gst_status:        d.gst_status,
        constitution:      d.constitution,
        registration_date: d.registration_date,
        partial:           json.partial,
        message:           json.message,
      })
      if (!json.partial) toast.success('GST data fetched — form auto-filled!')
    } catch {
      toast.error('GST lookup failed — check your connection')
    } finally {
      setGstLooking(false)
    }
  }

  function toggleTask(title: string) {
    setSelection(s => {
      const next = { ...s[title], selected: !s[title].selected }
      if (next.selected) setExpandedTasks(d => new Set([...d, title]))
      else setExpandedTasks(d => { const n = new Set(d); n.delete(title); return n })
      return { ...s, [title]: next }
    })
  }

  function updateSel(title: string, field: keyof TaskSelection, value: string) {
    setSelection(s => ({ ...s, [title]: { ...s[title], [field]: value } }))
  }

  function toggleGroup(g: string) {
    setExpandedGroups(p => { const n = new Set(p); n.has(g) ? n.delete(g) : n.add(g); return n })
  }

  function selectAllGroup(group: string) {
    const gt = COMPLIANCE_TASKS.filter(t => t.group === group)
    const all = gt.every(t => selection[t.title]?.selected)
    setSelection(s => {
      const u = { ...s }
      for (const t of gt) u[t.title] = { ...u[t.title], selected: !all }
      return u
    })
  }

  const filteredBySearch = useMemo(() => {
    const q = compSearch.toLowerCase().trim()
    if (!q) return COMPLIANCE_TASKS
    return COMPLIANCE_TASKS.filter(t =>
      t.title.toLowerCase().includes(q) || t.group.toLowerCase().includes(q)
    )
  }, [compSearch])

  const selectedTasks = COMPLIANCE_TASKS.filter(t => selection[t.title]?.selected)
  const selectedCount = selectedTasks.length

  async function doSubmit() {
    if (!form.name.trim()) { setError('Client name is required'); return }
    setSaving(true); setError('')
    try {
      const gstCustomFields = gstin.trim().length === 15 ? {
        gstin:       gstin.trim().toUpperCase(),
        pan:         gstInfo?.pan         ?? null,
        gst_status:  gstInfo?.gst_status  ?? null,
        gst_state:   gstInfo?.state       ?? null,
        gst_reg_date:gstInfo?.registration_date ?? null,
      } : undefined
      const clientRes = await fetch('/api/clients', {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({
          ...form, name: form.name.trim(),
          ...(gstCustomFields ? { custom_fields: gstCustomFields } : {}),
        }),
      })
      const clientData = await clientRes.json()
      if (!clientRes.ok) { setError(clientData.error ?? 'Failed to create client'); return }
      const clientId = clientData.data.id

      if (selectedCount > 0) {
        const taskPromises = selectedTasks.map(task => {
          const sel = selection[task.title]
          const ov  = orgOverrides[task.title]
          const attachments = getAttachments(task, orgOverrides)
          const cf: Record<string,any> = {}
          if (sel.daysBeforeDue) cf._days_before_show = parseInt(sel.daysBeforeDue)
          return fetch('/api/recurring', {
            method:'POST', headers:{ 'Content-Type':'application/json' },
            body: JSON.stringify({
              title:        ov?.title    ?? task.title,
              priority:     ov?.priority ?? task.priority,
              frequency:    sel.frequency,
              client_id:    clientId,
              assignee_id:  sel.assigneeId  || null,
              approver_id:  sel.approverId  || null,
              approval_required: !!sel.approverId,
              start_date:   sel.startDate || undefined,
              custom_fields: Object.keys(cf).length ? cf : undefined,
              subtasks:     attachments.map(a => ({ title: a.name || 'Attachment', required: true })),
              description:
                `CA Compliance | Category: ${task.category} | Group: ${task.group}` +
                (sel.endDate ? ` | End: ${sel.endDate}` : ''),
            }),
          })
        })
        await Promise.allSettled(taskPromises)
      }

      toast.success(
        `${form.name} added${selectedCount > 0 ? ` · ${selectedCount} compliance task${selectedCount !== 1 ? 's' : ''} created` : ''}!`
      )
      router.push(`/clients/${clientId}`)
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  /* ── STEP 1 ── */
  if (step === 1) {
    return (
      <div className="card p-6 space-y-5">
        {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

        {/* ── GSTIN Auto-fill ── */}
        <div style={{ background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)', border: '1px solid #bbf7d0', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ShieldCheck style={{ width: 14, height: 14, color: '#fff' }}/>
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#065f46', margin: 0 }}>Auto-fill via GSTIN</p>
              <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>Enter GST number to fetch business name, state &amp; more</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              ref={gstInputRef}
              value={gstin}
              onChange={e => {
                const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15)
                setGstin(v)
                setGstInfo(null)
                if (v.length === 15) lookupGSTIN(v)
              }}
              placeholder="e.g. 27AAGCM1234A1Z5"
              maxLength={15}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 8,
                border: gstin.length === 15 ? '1.5px solid #0d9488' : '1px solid #d1fae5',
                fontSize: 13, fontFamily: 'monospace', letterSpacing: '0.08em',
                outline: 'none', background: '#fff', color: '#065f46', fontWeight: 600,
              }}
            />
            <button
              type="button"
              onClick={() => lookupGSTIN(gstin)}
              disabled={gstin.length !== 15 || gstLooking}
              style={{
                padding: '8px 14px', borderRadius: 8, border: 'none',
                background: gstin.length === 15 ? '#0d9488' : '#d1fae5',
                color: gstin.length === 15 ? '#fff' : '#9ca3af',
                fontSize: 12, fontWeight: 600, cursor: gstin.length === 15 ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}>
              {gstLooking
                ? <><Loader2 style={{ width: 13, height: 13, animation: 'spin 0.7s linear infinite' }}/> Fetching…</>
                : 'Fetch'}
            </button>
          </div>

          {/* Progress indicator */}
          {gstin.length > 0 && gstin.length < 15 && (
            <p style={{ fontSize: 11, color: '#6b7280', margin: '6px 0 0' }}>
              {15 - gstin.length} more character{15 - gstin.length !== 1 ? 's' : ''} needed
            </p>
          )}

          {/* GST info card */}
          {gstInfo && (
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {gstInfo.pan && (
                <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: '#fff', border: '1px solid #d1fae5', color: '#065f46', fontWeight: 600 }}>
                  PAN: <span style={{ fontFamily: 'monospace' }}>{gstInfo.pan}</span>
                </span>
              )}
              {gstInfo.state && (
                <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: '#fff', border: '1px solid #d1fae5', color: '#065f46', fontWeight: 600 }}>
                  📍 {gstInfo.state}
                </span>
              )}
              {gstInfo.gst_status && (
                <span style={{
                  fontSize: 11, padding: '3px 8px', borderRadius: 6, fontWeight: 700,
                  background: gstInfo.gst_status.toLowerCase() === 'active' ? '#f0fdf4' : '#fef2f2',
                  color: gstInfo.gst_status.toLowerCase() === 'active' ? '#16a34a' : '#dc2626',
                  border: `1px solid ${gstInfo.gst_status.toLowerCase() === 'active' ? '#bbf7d0' : '#fecaca'}`,
                }}>
                  {gstInfo.gst_status}
                </span>
              )}
              {gstInfo.constitution && (
                <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: '#fff', border: '1px solid #d1fae5', color: '#6b7280' }}>
                  {gstInfo.constitution}
                </span>
              )}
              {gstInfo.registration_date && (
                <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: '#fff', border: '1px solid #d1fae5', color: '#6b7280' }}>
                  Reg: {gstInfo.registration_date}
                </span>
              )}
              {gstInfo.partial && gstInfo.message && (
                <p style={{ width: '100%', fontSize: 11, color: '#6b7280', margin: '2px 0 0', fontStyle: 'italic' }}>
                  ℹ️ {gstInfo.message}
                </p>
              )}
            </div>
          )}
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Client name *</label>
          <input value={form.name} onChange={e => setField('name', e.target.value)}
            className="input" placeholder="Acme Corp" autoFocus/>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input type="email" value={form.email} onChange={e => setField('email', e.target.value)}
              className="input" placeholder="hello@acme.com"/>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
            <input value={form.phone} onChange={e => setField('phone', e.target.value)}
              className="input" placeholder="+91 98765 43210"/>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Company</label>
            <input value={form.company} onChange={e => setField('company', e.target.value)}
              className="input" placeholder="Parent company"/>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Website</label>
            <input value={form.website} onChange={e => setField('website', e.target.value)}
              className="input" placeholder="https://acme.com"/>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
            <select value={form.status} onChange={e => setField('status', e.target.value)} className="input">
              <option value="active">Active</option>
              <option value="prospect">Prospect</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Industry</label>
            <input value={form.industry} onChange={e => setField('industry', e.target.value)}
              className="input" placeholder="e.g. Manufacturing"/>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Colour</label>
          <div className="flex gap-2 flex-wrap">
            {COLORS.map(c => (
              <button key={c} type="button" onClick={() => setField('color', c)}
                className="h-7 w-7 rounded-full hover:scale-110 transition-transform flex items-center justify-center"
                style={{ background: c }}>
                {form.color === c && (
                  <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3">
                    <path d="M13 4L6.5 11 3 7.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
          <textarea value={form.notes} onChange={e => setField('notes', e.target.value)}
            rows={3} className="input resize-none" placeholder="Internal notes..."/>
        </div>

        <div className="flex gap-3 pt-2">
          {caComplianceMode ? (
            <button type="button"
              onClick={() => {
                if (!form.name.trim()) { setError('Client name is required'); return }
                setError(''); setStep(2)
              }}
              className="btn btn-brand flex-1 flex items-center justify-center gap-2">
              <FileCheck className="h-4 w-4"/> Set up Compliance Tasks
              <ChevronRight className="h-4 w-4"/>
            </button>
          ) : (
            <button type="button"
              onClick={() => {
                if (!form.name.trim()) { setError('Client name is required'); return }
                setError(''); doSubmit()
              }}
              disabled={saving}
              className="btn btn-brand flex-1 flex items-center justify-center gap-2">
              {saving ? 'Adding…' : 'Add Client'}
            </button>
          )}
          <button type="button" onClick={() => router.back()} className="btn btn-outline">Cancel</button>
        </div>

        {caComplianceMode && (
          <button type="button"
            onClick={() => {
              if (!form.name.trim()) { setError('Client name is required'); return }
              setError(''); doSubmit()
            }}
            disabled={saving}
            className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors">
            Skip compliance setup → Add client directly
          </button>
        )}
      </div>
    )
  }

  /* ── STEP 2 ── */
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:0 }}>

      {/* Step 2 header */}
      <div style={{ background:'linear-gradient(135deg,#0f172a,#134e4a)', borderRadius:12,
        padding:'18px 20px', marginBottom:14 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
          <div style={{ width:32, height:32, borderRadius:8, background:'rgba(13,148,136,0.25)',
            display:'flex', alignItems:'center', justifyContent:'center' }}>
            <ShieldCheck style={{ width:16, height:16, color:'#5eead4' }}/>
          </div>
          <div>
            <h2 style={{ fontSize:15, fontWeight:700, color:'#fff', margin:0 }}>
              Compliance tasks for <span style={{ color:'#5eead4' }}>{form.name}</span>
            </h2>
            <p style={{ fontSize:11, color:'rgba(255,255,255,0.5)', margin:0 }}>
              Select tasks · set frequency, dates &amp; assignees · attachments from your templates
            </p>
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:7, flex:1, padding:'7px 11px',
            borderRadius:8, border:'1px solid rgba(255,255,255,0.15)', background:'rgba(255,255,255,0.08)' }}>
            <Search style={{ width:12, height:12, color:'rgba(255,255,255,0.4)', flexShrink:0 }}/>
            <input value={compSearch} onChange={e => setCompSearch(e.target.value)}
              placeholder="Search tasks…"
              style={{ flex:1, border:'none', outline:'none', background:'transparent',
                fontSize:12, color:'rgba(255,255,255,0.8)', fontFamily:'inherit' }}/>
            {compSearch && (
              <button onClick={() => setCompSearch('')}
                style={{ background:'none', border:'none', cursor:'pointer', padding:0 }}>
                <X style={{ width:11, height:11, color:'rgba(255,255,255,0.4)' }}/>
              </button>
            )}
          </div>
          {selectedCount > 0 && (
            <span style={{ fontSize:12, fontWeight:700, color:'#5eead4', background:'rgba(13,148,136,0.3)',
              padding:'5px 14px', borderRadius:99, whiteSpace:'nowrap', border:'1px solid rgba(13,148,136,0.4)' }}>
              {selectedCount} selected
            </span>
          )}
        </div>
      </div>

      {/* Group accordions — no maxHeight so page scrolls naturally */}
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {COMPLIANCE_GROUPS.map(group => {
          const groupTasks    = filteredBySearch.filter(t => t.group === group)
          if (groupTasks.length === 0) return null
          const isOpen        = expandedGroups.has(group)
          const color         = GROUP_COLORS[group] ?? '#455A64'
          const groupSelected = groupTasks.filter(t => selection[t.title]?.selected).length
          const allSelected   = groupSelected === groupTasks.length

          return (
            <div key={group} style={{ border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>

              {/* Group header */}
              <div style={{ display:'flex', alignItems:'center',
                background: groupSelected > 0 ? color + '12' : color + '07',
                borderBottom: isOpen ? `1px solid ${color}22` : 'none' }}>
                <button onClick={() => toggleGroup(group)}
                  style={{ flex:1, display:'flex', alignItems:'center', gap:8, padding:'9px 12px',
                    background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
                  <div style={{ width:8, height:8, borderRadius:2, background:color, flexShrink:0 }}/>
                  <span style={{ flex:1, fontSize:12, fontWeight:700, color:'var(--text-primary)' }}>{group}</span>
                  {groupSelected > 0 && (
                    <span style={{ fontSize:10, fontWeight:700, color:'#fff', background:color,
                      padding:'2px 8px', borderRadius:99 }}>
                      {groupSelected}/{groupTasks.length}
                    </span>
                  )}
                  {isOpen
                    ? <ChevronDown style={{ width:13, height:13, color:'var(--text-muted)' }}/>
                    : <ChevronRight style={{ width:13, height:13, color:'var(--text-muted)' }}/>}
                </button>
                <button onClick={() => selectAllGroup(group)}
                  style={{ padding:'5px 12px', marginRight:8, borderRadius:6, whiteSpace:'nowrap',
                    border:`1px solid ${color}44`, background: allSelected ? color+'18' : 'transparent',
                    color, fontSize:10, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                  {allSelected ? 'Deselect all' : 'Select all'}
                </button>
              </div>

              {/* Task rows */}
              {isOpen && groupTasks.map((task, idx) => {
                const sel           = selection[task.title]
                const isSelected    = sel?.selected
                const isExpanded    = expandedTasks.has(task.title)
                const attachments   = getAttachments(task, orgOverrides)
                const isLast        = idx === groupTasks.length - 1

                return (
                  <div key={task.title}
                    style={{ borderBottom: isLast && !isExpanded ? 'none' : '1px solid var(--border-light)' }}>

                    {/* Task row */}
                    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px',
                      background: isSelected ? color + '07' : 'var(--surface)',
                      cursor:'pointer' }}
                      onClick={() => toggleTask(task.title)}>

                      <div style={{ width:18, height:18, borderRadius:5, flexShrink:0,
                        border: isSelected ? `2px solid ${color}` : '2px solid var(--border)',
                        background: isSelected ? color : 'transparent',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        transition:'all 0.12s' }}>
                        {isSelected && <Check style={{ width:11, height:11, color:'#fff' }}/>}
                      </div>

                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontSize:12, fontWeight: isSelected ? 600 : 400, margin:0,
                          color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {orgOverrides[task.title]?.title ?? task.title}
                        </p>
                        <p style={{ fontSize:10, color:'var(--text-muted)', margin:'1px 0 0' }}>
                          {task.category}
                        </p>
                      </div>

                      <span style={{ fontSize:10, fontWeight:500, color:'var(--text-muted)',
                        background:'var(--surface-subtle)', padding:'2px 7px', borderRadius:99,
                        flexShrink:0, whiteSpace:'nowrap' }}>
                        {getFreqLabel(sel?.frequency ?? task.frequency)}
                      </span>

                      {attachments.length > 0 && (
                        <span style={{ display:'flex', alignItems:'center', gap:3, fontSize:10, fontWeight:600,
                          color:'#0891b2', background:'rgba(8,145,178,0.1)', padding:'2px 7px', borderRadius:99, flexShrink:0 }}>
                          <Paperclip style={{ width:9, height:9 }}/> {attachments.length}
                        </span>
                      )}

                      <div style={{ width:7, height:7, borderRadius:'50%', flexShrink:0,
                        background: task.priority === 'high' ? '#dc2626' : task.priority === 'medium' ? '#ca8a04' : '#16a34a' }}/>

                      {isSelected && (
                        <button onClick={e => {
                          e.stopPropagation()
                          setExpandedTasks(d => { const n = new Set(d); n.has(task.title) ? n.delete(task.title) : n.add(task.title); return n })
                        }}
                          style={{ display:'flex', alignItems:'center', gap:3, padding:'3px 8px',
                            borderRadius:6, border:`1px solid ${color}44`,
                            background: isExpanded ? color+'18' : 'transparent',
                            color, fontSize:10, fontWeight:500, cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}>
                          <Calendar style={{ width:10, height:10 }}/> Configure
                        </button>
                      )}
                    </div>

                    {/* Expanded detail */}
                    {isSelected && isExpanded && (
                      <div style={{ padding:'12px 14px 14px', background:'var(--surface-subtle)',
                        borderTop:`1px solid ${color}18` }}
                        onClick={e => e.stopPropagation()}>

                        {/* Row 1: frequency + dates */}
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 }}>
                          <div>
                            <label style={{ fontSize:10, fontWeight:600, color:'var(--text-muted)', display:'block',
                              marginBottom:4, textTransform:'uppercase', letterSpacing:'0.05em' }}>Frequency</label>
                            <select value={sel.frequency}
                              onChange={e => updateSel(task.title, 'frequency', e.target.value)}
                              style={{ width:'100%', padding:'6px 8px', borderRadius:7, border:'1px solid var(--border)',
                                fontSize:12, background:'var(--surface)', color:'var(--text-primary)',
                                fontFamily:'inherit', outline:'none' }}>
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
                            <label style={{ fontSize:10, fontWeight:600, color:'var(--text-muted)', display:'block',
                              marginBottom:4, textTransform:'uppercase', letterSpacing:'0.05em' }}>Start date</label>
                            <input type="date" value={sel.startDate}
                              onChange={e => updateSel(task.title, 'startDate', e.target.value)}
                              style={{ width:'100%', padding:'6px 8px', borderRadius:7, border:'1px solid var(--border)',
                                fontSize:12, background:'var(--surface)', color:'var(--text-primary)',
                                fontFamily:'inherit', outline:'none' }}/>
                          </div>
                          <div>
                            <label style={{ fontSize:10, fontWeight:600, color:'var(--text-muted)', display:'block',
                              marginBottom:4, textTransform:'uppercase', letterSpacing:'0.05em' }}>End date</label>
                            <input type="date" value={sel.endDate}
                              onChange={e => updateSel(task.title, 'endDate', e.target.value)}
                              style={{ width:'100%', padding:'6px 8px', borderRadius:7, border:'1px solid var(--border)',
                                fontSize:12, background:'var(--surface)', color:'var(--text-primary)',
                                fontFamily:'inherit', outline:'none' }}/>
                          </div>
                        </div>

                        {/* Row 2: assignee + approver + days before */}
                        {members.length > 0 && (
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 }}>
                            <div>
                              <label style={{ fontSize:10, fontWeight:600, color:'var(--text-muted)', display:'block',
                                marginBottom:4, textTransform:'uppercase', letterSpacing:'0.05em' }}>
                                <User style={{ width:9, height:9, display:'inline', marginRight:3 }}/>Assignee
                              </label>
                              <select value={sel.assigneeId}
                                onChange={e => updateSel(task.title, 'assigneeId', e.target.value)}
                                style={{ width:'100%', padding:'6px 8px', borderRadius:7, border:'1px solid var(--border)',
                                  fontSize:12, background:'var(--surface)', color:'var(--text-primary)',
                                  fontFamily:'inherit', outline:'none' }}>
                                <option value="">Unassigned</option>
                                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                              </select>
                            </div>
                            <div>
                              <label style={{ fontSize:10, fontWeight:600, color:'var(--text-muted)', display:'block',
                                marginBottom:4, textTransform:'uppercase', letterSpacing:'0.05em' }}>
                                <Shield style={{ width:9, height:9, display:'inline', marginRight:3 }}/>Approver
                              </label>
                              <select value={sel.approverId}
                                onChange={e => updateSel(task.title, 'approverId', e.target.value)}
                                style={{ width:'100%', padding:'6px 8px', borderRadius:7, border:'1px solid var(--border)',
                                  fontSize:12, background:'var(--surface)', color:'var(--text-primary)',
                                  fontFamily:'inherit', outline:'none' }}>
                                <option value="">No approval</option>
                                {approvers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                              </select>
                            </div>
                            <div>
                              <label style={{ fontSize:10, fontWeight:600, color:'var(--text-muted)', display:'block',
                                marginBottom:4, textTransform:'uppercase', letterSpacing:'0.05em' }}>
                                <Bell style={{ width:9, height:9, display:'inline', marginRight:3 }}/>Show task N days before due
                              </label>
                              <input type="number" min="1" max="90" value={sel.daysBeforeDue}
                                onChange={e => updateSel(task.title, 'daysBeforeDue', e.target.value)}
                                placeholder="e.g. 7"
                                style={{ width:'100%', padding:'6px 8px', borderRadius:7, border:'1px solid var(--border)',
                                  fontSize:12, background:'var(--surface)', color:'var(--text-primary)',
                                  fontFamily:'inherit', outline:'none' }}/>
                            </div>
                          </div>
                        )}

                        {/* Required attachments */}
                        {attachments.length > 0 && (
                          <div style={{ borderTop:'1px solid var(--border-light)', paddingTop:10 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:7 }}>
                              <Paperclip style={{ width:12, height:12, color:'#0891b2' }}/>
                              <span style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)',
                                textTransform:'uppercase', letterSpacing:'0.05em' }}>
                                Required attachments ({attachments.length})
                              </span>
                            </div>
                            <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                              {attachments.map((a, i) => (
                                <div key={i} style={{ display:'flex', alignItems:'center', gap:5,
                                  fontSize:11, color:'var(--text-secondary)',
                                  background:'var(--surface)', border:'1px solid var(--border)',
                                  padding:'5px 10px', borderRadius:7 }}>
                                  <span style={{ width:18, height:18, borderRadius:5, background:'#0891b2',
                                    color:'#fff', fontSize:9, fontWeight:700, display:'flex',
                                    alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                                    {i + 1}
                                  </span>
                                  <span>{a.name || `Attachment ${i + 1}`}</span>
                                  <span style={{ fontSize:9, fontWeight:700, color:'#dc2626',
                                    background:'rgba(220,38,38,0.08)', padding:'1px 5px', borderRadius:4 }}>REQ</span>
                                </div>
                              ))}
                            </div>
                            <p style={{ fontSize:10, color:'var(--text-muted)', margin:'7px 0 0' }}>
                              Inherited from CA Compliance Hub.{' '}
                              <a href="/compliance" target="_blank" rel="noopener noreferrer"
                                style={{ color:'#0d9488', textDecoration:'none' }}>Edit templates →</a>
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      {error && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      <div style={{ display:'flex', gap:10, marginTop:16, alignItems:'center' }}>
        <button type="button" onClick={() => setStep(1)}
          style={{ display:'flex', alignItems:'center', gap:5, padding:'10px 18px',
            borderRadius:8, border:'1px solid var(--border)', background:'var(--surface)',
            color:'var(--text-secondary)', fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>
          ← Back
        </button>
        <button type="button" onClick={doSubmit} disabled={saving}
          style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:7,
            padding:'11px 20px', borderRadius:8, border:'none',
            background: saving ? 'var(--border)' : '#0d9488', color:'#fff',
            fontSize:13, fontWeight:600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily:'inherit' }}>
          <Building2 style={{ width:14, height:14 }}/>
          {saving
            ? 'Creating…'
            : selectedCount > 0
              ? `Create ${form.name || 'client'} with ${selectedCount} compliance task${selectedCount !== 1 ? 's' : ''}`
              : `Create ${form.name || 'client'} (no compliance tasks)`}
        </button>
      </div>
      {selectedCount === 0 && (
        <p style={{ textAlign:'center', fontSize:11, color:'var(--text-muted)', marginTop:6 }}>
          No tasks selected. You can add compliance tasks later from the client page.
        </p>
      )}
    </div>
  )
}
