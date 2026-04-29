'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, RefreshCw, User, Flag, Briefcase, Paperclip, Shield, ToggleLeft, ToggleRight, ListPlus, Trash2 } from 'lucide-react'
import { toast } from '@/store/appStore'
import { useOrgSettings }         from '@/lib/hooks/useOrgSettings'
import { QuickAddClientModal }   from '@/components/clients/QuickAddClientModal'
import { InlineCustomFields } from '@/components/tasks/InlineCustomFields'

// ── Granular frequency options ─────────────────────────────────
export const FREQUENCIES = [
  { group: 'Daily',     v: 'daily',            l: 'Every day' },
  { group: 'Daily',     v: 'custom_daily',     l: 'Every N days…' },
  { group: 'Weekly',    v: 'weekly_mon',       l: 'Every Monday' },
  { group: 'Weekly',    v: 'weekly_tue',       l: 'Every Tuesday' },
  { group: 'Weekly',    v: 'weekly_wed',       l: 'Every Wednesday' },
  { group: 'Weekly',    v: 'weekly_thu',       l: 'Every Thursday' },
  { group: 'Weekly',    v: 'weekly_fri',       l: 'Every Friday' },
  { group: 'Weekly',    v: 'bi_weekly',        l: 'Every 2 weeks' },
  { group: 'Monthly',   v: 'monthly_1',        l: '1st of every month' },
  { group: 'Monthly',   v: 'monthly_7',        l: '7th of every month' },
  { group: 'Monthly',   v: 'monthly_10',       l: '10th of every month' },
  { group: 'Monthly',   v: 'monthly_11',       l: '11th of every month' },
  { group: 'Monthly',   v: 'monthly_13',       l: '13th of every month' },
  { group: 'Monthly',   v: 'monthly_15',       l: '15th of every month' },
  { group: 'Monthly',   v: 'monthly_20',       l: '20th of every month' },
  { group: 'Monthly',   v: 'monthly_25',       l: '25th of every month' },
  { group: 'Monthly',   v: 'monthly_last',     l: 'Last day of month' },
  { group: 'Monthly',   v: 'monthly',          l: 'Monthly (same date)' },
  { group: 'Monthly',   v: 'monthly_custom',   l: 'Custom date…' },
  { group: 'Quarterly', v: 'quarterly_13',     l: '13th of quarter-end' },
  { group: 'Quarterly', v: 'quarterly_15',     l: '15th of quarter-end' },
  { group: 'Quarterly', v: 'quarterly_25',     l: '25th of quarter-end' },
  { group: 'Quarterly', v: 'quarterly_last',   l: 'Last day of quarter' },
  { group: 'Quarterly', v: 'quarterly',        l: 'Quarterly (same date)' },
  { group: 'Quarterly', v: 'quarterly_custom', l: 'Custom date…' },
  { group: 'Annual',    v: 'annual_31jul',     l: '31st July (annual)' },
  { group: 'Annual',    v: 'annual_30sep',     l: '30th September (annual)' },
  { group: 'Annual',    v: 'annual_31dec',     l: '31st December (annual)' },
  { group: 'Annual',    v: 'annual_31mar',     l: '31st March (annual)' },
  { group: 'Annual',    v: 'annual',           l: 'Annually (same date)' },
  { group: 'Annual',    v: 'annual_custom',    l: 'Custom date…' },
]

const MONTHS_SHORT = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
const MONTHS_LABEL = ['January','February','March','April','May','June','July','August','September','October','November','December']

const FREQ_LABEL_MAP: Record<string, string> = Object.fromEntries(FREQUENCIES.map(f => [f.v, f.l]))

const WEEKDAY_NAMES: Record<string, string> = { mon:'Mon', tue:'Tue', wed:'Wed', thu:'Thu', fri:'Fri', sat:'Sat', sun:'Sun' }
const WEEKDAY_ORDER = ['mon','tue','wed','thu','fri','sat','sun']

/** Returns a human-readable label for any frequency string, including dynamic ones */
function getFreqLabel(freq: string): string {
  if (FREQ_LABEL_MAP[freq]) return FREQ_LABEL_MAP[freq]
  // weekly_days:mon,wed,fri
  const wdMatch = freq.match(/^weekly_days:(.+)$/)
  if (wdMatch) return 'Every ' + wdMatch[1].split(',').map(d => WEEKDAY_NAMES[d] ?? d).join(', ')
  // monthly_days:1,15,25
  const mdMatch = freq.match(/^monthly_days:(.+)$/)
  if (mdMatch) {
    const days = mdMatch[1].split(',').map(Number).sort((a, b) => a - b)
    return days.join(', ') + ' of every month'
  }
  // every_N_days
  const everyMatch = freq.match(/^every_(\d+)_days$/)
  if (everyMatch) return `Every ${everyMatch[1]} day${everyMatch[1]==='1'?'':'s'}`
  // monthly_N (custom day)
  const monthMatch = freq.match(/^monthly_(\d+)$/)
  if (monthMatch) return `${monthMatch[1]}th of every month`
  // quarterly_N
  const qMatch = freq.match(/^quarterly_(\d+)$/)
  if (qMatch) return `${qMatch[1]}th of quarter-end`
  // annual_Nmon
  const annMatch = freq.match(/^annual_(\d+)([a-z]+)$/)
  if (annMatch) {
    const mIdx = MONTHS_SHORT.indexOf(annMatch[2])
    return `${annMatch[1]}${mIdx >= 0 ? ' ' + MONTHS_LABEL[mIdx] : annMatch[2]} (annual)`
  }
  return freq
}

const FREQ_LABEL: Record<string, string> = new Proxy(FREQ_LABEL_MAP, {
  get(target, key: string) { return target[key] ?? getFreqLabel(key) }
})

const PRIORITY_OPTIONS = [
  { value: 'none',   label: 'No priority', color: '#94a3b8' },
  { value: 'low',    label: 'Low',         color: '#16a34a' },
  { value: 'medium', label: 'Medium',      color: '#ca8a04' },
  { value: 'high',   label: 'High',        color: '#ea580c' },
  { value: 'urgent', label: 'Urgent',      color: '#dc2626' },
]

interface Props {
  members:        { id: string; name: string }[]
  clients?:       { id: string; name: string; color: string }[]
  currentUserId?: string
  defaultOpen?:   boolean
  defaultFreqModalOpen?: boolean
  editTask?: {
    id: string; title: string; frequency: string; priority: string
    assignee_id: string | null; client_id?: string | null; approver_id?: string | null
  }
  onCreated?:    (task?: any) => void
  onEdited?:     () => void
  onCancelEdit?: () => void
}

export function InlineRecurringTask({ members, clients = [], currentUserId, defaultOpen = false, defaultFreqModalOpen = false, editTask, onCreated, onEdited, onCancelEdit }: Props) {
  const router   = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const rowRef   = useRef<HTMLDivElement>(null)
  const fileRef  = useRef<HTMLInputElement>(null)

  const isEdit = !!editTask
  const { customFields, taskFields } = useOrgSettings()
  const show     = (key: string) => taskFields[key]?.visible !== false
  const required = (key: string) => taskFields[key]?.mandatory === true
  const [errors,       setErrors]       = useState<Record<string,string>>({})
  const [customValues,    setCustomValues]    = useState<Record<string,any>>({})
  const [showAddClient,   setShowAddClient]   = useState(false)
  const [clientList,      setClientList]      = useState(clients)
  // Keep clientList in sync when the prop changes (e.g. after a new client is added upstream)
  useEffect(() => { setClientList(clients) }, [clients])
  const [compSubtasks,   setCompSubtasks]   = useState<{title:string;required:boolean;due_date?:string;assignee_id?:string}[]>([])
  const [requireAttachment, setRequireAttachment] = useState(false)
  const [open,      setOpen]      = useState(isEdit || defaultOpen)
  const [saving,    setSaving]    = useState(false)
  const [title,     setTitle]     = useState(editTask?.title ?? '')
  const [frequency, setFrequency] = useState(editTask?.frequency ?? 'weekly_mon')
  const [priority,  setPriority]  = useState(editTask?.priority ?? 'medium')
  const [assignee,  setAssignee]  = useState(editTask?.assignee_id ?? currentUserId ?? '')
  const [approverId,setApproverId] = useState(editTask?.approver_id ?? '')
  const [clientId,  setClientId]  = useState(editTask?.client_id ?? '')
  const [files,            setFiles]           = useState<File[]>([])
  const [customInterval,   setCustomInterval]   = useState(2)   // for "every N days"
  const [customDay,        setCustomDay]        = useState(1)   // for monthly/quarterly custom day
  const [customAnnualDay,  setCustomAnnualDay]  = useState(15)  // for annual custom day
  const [customAnnualMonth,setCustomAnnualMonth]= useState('jan') // for annual custom month

  // Frequency picker modal state
  type FreqModalType = 'daily' | 'every_n_days' | 'weekly_day' | 'every_n_weeks' | 'monthly_day'
  const [freqModalOpen,  setFreqModalOpen]  = useState(false)
  const [draftType,      setDraftType]      = useState<FreqModalType>('daily')
  const [draftNDays,     setDraftNDays]     = useState(2)
  const [draftWeekdays,  setDraftWeekdays]  = useState<string[]>(['mon'])
  const [draftNWeeks,    setDraftNWeeks]    = useState(2)
  const [draftMonthDays, setDraftMonthDays] = useState<number[]>([1])

  function openFreqModal() {
    // Init drafts from current frequency
    if (frequency === 'daily') {
      setDraftType('daily')
    } else if (frequency === 'custom_daily') {
      setDraftType('every_n_days'); setDraftNDays(customInterval)
    } else if (frequency.startsWith('weekly_days:')) {
      setDraftType('weekly_day'); setDraftWeekdays(frequency.replace('weekly_days:', '').split(','))
    } else if (frequency.startsWith('weekly_')) {
      setDraftType('weekly_day'); setDraftWeekdays([frequency.replace('weekly_', '')])
    } else if (frequency === 'bi_weekly') {
      setDraftType('every_n_weeks'); setDraftNWeeks(2)
    } else {
      const evM = frequency.match(/^every_(\d+)_days$/)
      const moM = frequency.match(/^monthly_(\d+)$/)
      const mdM = frequency.match(/^monthly_days:(.+)$/)
      if (evM) {
        const d = parseInt(evM[1])
        if (d % 7 === 0 && d >= 14 && d <= 28) { setDraftType('every_n_weeks'); setDraftNWeeks(d / 7) }
        else { setDraftType('every_n_days'); setDraftNDays(Math.min(7, d)) }
      } else if (mdM) {
        setDraftType('monthly_day'); setDraftMonthDays(mdM[1].split(',').map(Number))
      } else if (moM) {
        setDraftType('monthly_day'); setDraftMonthDays([parseInt(moM[1])])
      } else if (frequency === 'monthly_custom') {
        setDraftType('monthly_day'); setDraftMonthDays([customDay])
      } else {
        setDraftType('daily')
      }
    }
    setFreqModalOpen(true)
  }

  function confirmFreqModal() {
    if (draftType === 'daily') {
      setFrequency('daily')
    } else if (draftType === 'every_n_days') {
      setFrequency('custom_daily'); setCustomInterval(draftNDays)
    } else if (draftType === 'weekly_day') {
      const sorted = [...draftWeekdays].sort((a, b) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b))
      if (sorted.length === 1) setFrequency(`weekly_${sorted[0]}`)
      else setFrequency(`weekly_days:${sorted.join(',')}`)
    } else if (draftType === 'every_n_weeks') {
      if (draftNWeeks === 2) setFrequency('bi_weekly')
      else setFrequency(`every_${draftNWeeks * 7}_days`)
    } else if (draftType === 'monthly_day') {
      const sorted = [...draftMonthDays].sort((a, b) => a - b)
      if (sorted.length === 1) { setFrequency('monthly_custom'); setCustomDay(sorted[0]) }
      else setFrequency(`monthly_days:${sorted.join(',')}`)
    }
    setFreqModalOpen(false)
  }

  // Derive the effective frequency string to save (resolves sentinel values)
  const effectiveFrequency: string = (() => {
    if (frequency === 'custom_daily')     return `every_${Math.max(1, customInterval)}_days`
    if (frequency === 'monthly_custom')   return `monthly_${Math.max(1, Math.min(31, customDay))}`
    if (frequency === 'quarterly_custom') return `quarterly_${Math.max(1, Math.min(31, customDay))}`
    if (frequency === 'annual_custom')    return `annual_${Math.max(1, Math.min(31, customAnnualDay))}${customAnnualMonth}`
    return frequency
  })()

  // Auto-focus input when opened (handles both defaultOpen=true and openRow())
  useEffect(() => {
    if (open && !isEdit) setTimeout(() => inputRef.current?.focus(), 80)
  }, [open, isEdit])

  // Auto-open frequency modal when instructed (e.g. clicking the frequency badge on an existing task)
  useEffect(() => {
    if (defaultFreqModalOpen) openFreqModal()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (freqModalOpen) return
    if (rowRef.current && !rowRef.current.contains(e.target as Node) && !title.trim()) close()
  }, [title, freqModalOpen])

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [handleClickOutside])

  function close() {
    if (isEdit) { onCancelEdit?.(); return }
    setOpen(false); setTitle(''); setFrequency('weekly_mon'); setPriority('medium')
    setClientId(''); setAssignee(currentUserId ?? ''); setApproverId(''); setFiles([])
    setRequireAttachment(false); setCompSubtasks([])
    setCustomInterval(2); setCustomDay(1); setCustomAnnualDay(15); setCustomAnnualMonth('jan')
  }

  function validate(): boolean {
    const errs: Record<string,string> = {}
    if (!title.trim()) errs.title = 'Title required'
    if (required('assignee')   && !assignee)   errs.assignee   = 'Assignee required'
    if (required('client')     && !clientId)   errs.client     = 'Client required'
    if (required('attachment') && files.length === 0) errs.attachment = 'Attachment required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function save() {
    if (!validate()) return
    if (!title.trim()) { inputRef.current?.focus(); return }
    setSaving(true)
    try {
      const cfBase = { ...customValues }
      if (requireAttachment) cfBase._require_attachment = true
      const body = {
        title:         title.trim(),
        frequency:     effectiveFrequency,
        priority,
        assignee_id:   assignee     || null,
        approver_id:   approverId   || null,
        client_id:     clientId     || null,
        start_date:    new Date().toISOString().split('T')[0],
        custom_fields: Object.keys(cfBase).length > 0 ? cfBase : undefined,
        subtasks:      compSubtasks.length > 0 ? compSubtasks : undefined,
      }
      let res: Response
      if (isEdit) {
        res = await fetch(`/api/recurring/${editTask!.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } else {
        res = await fetch('/api/recurring', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }
      const d = await res.json()
      if (!res.ok) { toast.error(d.error ?? 'Failed'); return }

      // Upload attachments if any
      if (files.length > 0 && d.data?.id) {
        const fd = new FormData()
        files.forEach(f => fd.append('files', f))
        await fetch(`/api/tasks/${d.data.id}/attachments`, { method: 'POST', body: fd })
      }

      toast.success(isEdit ? 'Updated ✓' : 'Repeat task created ✓')
      if (isEdit) { onEdited?.(); return }
      close()
      onCreated ? onCreated(d.data) : router.refresh()
    } finally { setSaving(false) }
  }

  const priConf = PRIORITY_OPTIONS.find(p => p.value === priority) ?? PRIORITY_OPTIONS[2]

  if (!open) {
    return (
      <>
      {showAddClient && (
        <QuickAddClientModal
          onClose={() => setShowAddClient(false)}
          onCreated={newClient => {
            setClientList(p => [...p, newClient])
            setClientId(newClient.id)
            setShowAddClient(false)
          }}
        />
      )}
      <div onClick={() => setOpen(true)} style={{
        display:'flex', alignItems:'center', gap:8, padding:'10px 20px',
        cursor:'pointer', borderTop:'1px dashed var(--border)', color:'var(--text-muted)',
        transition:'all 0.15s', userSelect:'none',
      }}
      onMouseEnter={e=>{(e.currentTarget as any).style.color='var(--brand)';(e.currentTarget as any).style.background='var(--brand-light)'}}
      onMouseLeave={e=>{(e.currentTarget as any).style.color='var(--text-muted)';(e.currentTarget as any).style.background='transparent'}}>
        <Plus style={{ width:14, height:14, flexShrink:0 }}/>
        <span style={{ fontSize:13 }}>Add repeat task</span>
      </div>
      </>
    )
  }

  return (
    <>
    {/* Placeholder glorification for recurring task name field */}
    <style>{`
      .irt-title-input::placeholder {
        color: rgba(13,148,136,0.55);
        font-weight: 500;
        font-style: italic;
      }
    `}</style>
    {showAddClient && (
      <QuickAddClientModal
        onClose={() => setShowAddClient(false)}
        onCreated={newClient => {
          setClientList(p => [...p, newClient])
          setClientId(newClient.id)
          setShowAddClient(false)
        }}
      />
    )}
    <div ref={rowRef} style={{
      margin:'6px 12px 10px', borderRadius:10,
      border:'1.5px solid var(--brand-border)',
      background:'var(--surface)',
      boxShadow:'0 2px 12px rgba(13,148,136,0.08)',
      overflow:'hidden',
    }}>
      {/* Title row — glorified: accent left-border + tinted bg fade away as user types */}
      <div style={{
        display:'flex', alignItems:'center', gap:10,
        padding:'12px 14px 10px',
        background: title ? 'transparent' : 'rgba(13,148,136,0.045)',
        borderLeft: title ? '3px solid transparent' : '3px solid var(--brand)',
        transition:'background 0.25s ease, border-left-color 0.25s ease',
      }}>
        <RefreshCw style={{
          width:15, height:15, color:'var(--brand)', flexShrink:0,
          opacity: title ? 0.45 : 1,
          transition:'opacity 0.25s ease',
        }}/>
        <input ref={inputRef} value={title} onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key==='Enter') save(); if (e.key==='Escape') close() }}
          placeholder="What repeats? Name this task…"
          className="irt-title-input"
          style={{ flex:1, fontSize:15, fontWeight:600, border:'none', outline:'none',
            background:'transparent', color:'var(--text-primary)', fontFamily:'inherit' }}/>
        <button onClick={close} style={{ background:'none', border:'none', cursor:'pointer',
          color:'var(--text-muted)', display:'flex', padding:2, borderRadius:4 }}>
          <X style={{ width:13, height:13 }}/>
        </button>
      </div>

      <div style={{ height: title ? 1 : 2, background: title ? 'var(--border-light)' : 'rgba(13,148,136,0.2)', margin:'0 14px', transition:'height 0.25s, background 0.25s' }}/>

      {/* Options pills */}
      <div style={{ padding:'8px 14px 4px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', rowGap:6 }}>

        {/* Frequency — pill button opens modal */}
        <button type="button" onClick={openFreqModal}
          style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px',
            borderRadius:20, border:'1.5px solid var(--brand-border)',
            background:'var(--brand-light)', cursor:'pointer', fontFamily:'inherit' }}>
          <RefreshCw style={{ width:10, height:10, color:'var(--brand)', flexShrink:0 }}/>
          <span style={{ fontSize:12, color:'var(--brand)', fontWeight:500 }}>{FREQ_LABEL[frequency]}</span>
          <svg viewBox="0 0 10 6" fill="none" style={{ width:8, height:8, color:'var(--brand)', flexShrink:0 }}>
            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Assignee */}
        <label style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px',
          borderRadius:20, border:'1px solid var(--border)',
          background:'var(--surface-subtle)', cursor:'pointer' }}>
          <User style={{ width:11, height:11, color:'var(--text-muted)', flexShrink:0 }}/>
          <select value={assignee} onChange={e => setAssignee(e.target.value)}
            style={{ fontSize:12, border:'none', outline:'none',
              background:'transparent', color:'var(--text-secondary)',
              cursor:'pointer', appearance:'none' }}>
            <option value="">Unassigned</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}{m.id===currentUserId?' (me)':''}</option>)}
          </select>
        </label>

        {/* Approver */}
        <label style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px',
          borderRadius:20,
          border: approverId ? '1px solid #7c3aed55' : '1px solid var(--border)',
          background: approverId ? '#f5f3ff' : 'var(--surface-subtle)',
          cursor:'pointer' }}>
          <Shield style={{ width:11, height:11, color: approverId ? '#7c3aed' : 'var(--text-muted)', flexShrink:0 }}/>
          <select value={approverId} onChange={e => setApproverId(e.target.value)}
            style={{ fontSize:12, border:'none', outline:'none',
              background:'transparent',
              color: approverId ? '#7c3aed' : 'var(--text-secondary)',
              cursor:'pointer', appearance:'none', fontWeight: approverId ? 600 : 400 }}>
            <option value="">Approver…</option>
            {members.filter(m => m.id !== assignee).map(m => (
              <option key={m.id} value={m.id}>{m.name}{m.id===currentUserId?' (me)':''}</option>
            ))}
          </select>
        </label>

        {/* Priority */}
        <label style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px',
          borderRadius:20, border:`1px solid ${priConf.color}44`,
          background:`${priConf.color}18`, cursor:'pointer' }}>
          <Flag style={{ width:11, height:11, color:priConf.color, flexShrink:0 }}/>
          <select value={priority} onChange={e => setPriority(e.target.value)}
            style={{ fontSize:12, border:'none', outline:'none',
              background:'transparent', color:priConf.color,
              cursor:'pointer', appearance:'none', fontWeight:500 }}>
            {PRIORITY_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        {/* Client */}
        {show('client') && ( /* always show client pill */
          <label style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px',
            borderRadius:20,
            border: errors.client ? '1px solid #fca5a5'
              : clientId ? `1px solid ${clientList.find(c=>c.id===clientId)?.color ?? '#0d9488'}55`
              : '1px solid var(--border)',
            background: errors.client ? '#fef2f2'
              : clientId ? `${clientList.find(c=>c.id===clientId)?.color ?? '#0d9488'}14`
              : 'var(--surface-subtle)',
            cursor:'pointer' }}>
            {clientId
              ? <span style={{ width:8, height:8, borderRadius:2, flexShrink:0,
                  background:clientList.find(c=>c.id===clientId)?.color??'#0d9488', display:'inline-block' }}/>
              : <Briefcase style={{ width:11, height:11, color: errors.client?'#dc2626':'var(--text-muted)', flexShrink:0 }}/>
            }
            <select value={clientId} onChange={e => {
                if (e.target.value === '__add__') { setShowAddClient(true) }
                else { setClientId(e.target.value); setErrors(p => ({...p, client:''})) }
              }}
              style={{ fontSize:12, border:'none', outline:'none',
                background:'transparent',
                color: clientId ? (clientList.find(c=>c.id===clientId)?.color??'#0d9488')
                  : errors.client ? '#dc2626' : 'var(--text-secondary)',
                cursor:'pointer', appearance:'none', fontWeight: clientId?600:400 }}>
              <option value="">{required('client') ? 'Client *' : 'Client…'}</option>
              {clientList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value="__add__">+ Add new client…</option>
            </select>
          </label>
        )}

        {/* Attachment */}
        {show('attachment') && <button onClick={() => fileRef.current?.click()}
          style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px',
            borderRadius:20, border:'1px solid var(--border)', background:'var(--surface-subtle)',
            cursor:'pointer', fontSize:12, color:'var(--text-secondary)',
            fontFamily:'inherit' }}>
          <Paperclip style={{ width:11, height:11 }}/>
          {files.length > 0 ? `${files.length} file${files.length>1?'s':''}` : 'Attach'}
        </button>
        }
        <input ref={fileRef} type="file" multiple style={{ display:'none' }}
          onChange={e => setFiles(Array.from(e.target.files ?? []))}/>

        {/* Custom fields */}
        {customFields.length > 0 && (
          <InlineCustomFields
            defs={customFields}
            values={customValues}
            onChange={(k, v) => setCustomValues(p => ({ ...p, [k]: v }))}
          />
        )}

      </div>

        {/* Validation errors */}
        {Object.values(errors).some(Boolean) && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:4, paddingTop:6 }}>
            {Object.entries(errors).filter(([,v]) => v).map(([k, v]) => (
              <span key={k} style={{ fontSize:11, color:'#dc2626', background:'#fef2f2', padding:'2px 8px', borderRadius:99 }}>{v}</span>
            ))}
          </div>
        )}
      </div>

      {/* Subtasks — editable grid with per-subtask assignee */}
      <div style={{ padding:'0 14px 8px' }}>
        {compSubtasks.length > 0 && (
          <div style={{ padding:'8px 12px', borderRadius:8, marginBottom:6,
            background:'rgba(13,148,136,0.04)', border:'1px solid rgba(13,148,136,0.2)' }}>
            <p style={{ fontSize:10, fontWeight:700, color:'var(--brand)', marginBottom:8,
              textTransform:'uppercase', letterSpacing:'0.06em' }}>Subtasks</p>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {compSubtasks.map((s, i) => (
                <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 140px 110px auto', gap:5, alignItems:'center' }}>
                  <input value={s.title}
                    onChange={e => setCompSubtasks(p => p.map((x,xi) => xi===i ? {...x, title:e.target.value} : x))}
                    placeholder="Subtask name…"
                    style={{ fontSize:12, border:'1px solid var(--border)', borderRadius:6,
                      padding:'4px 8px', background:'var(--surface)',
                      color:'var(--text-primary)', outline:'none', fontFamily:'inherit' }}/>
                  <select value={s.assignee_id ?? ''}
                    onChange={e => setCompSubtasks(p => p.map((x,xi) => xi===i ? {...x, assignee_id:e.target.value||undefined} : x))}
                    style={{ fontSize:11, border:'1px solid var(--border)', borderRadius:6,
                      padding:'4px 6px', background:'var(--surface)',
                      color:'var(--text-secondary)', outline:'none', fontFamily:'inherit', cursor:'pointer' }}>
                    <option value="">Assignee (task default)</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.name}{m.id===currentUserId?' (me)':''}</option>)}
                  </select>
                  <input type="date" value={s.due_date ?? ''}
                    onChange={e => setCompSubtasks(p => p.map((x,xi) => xi===i ? {...x, due_date:e.target.value||undefined} : x))}
                    style={{ fontSize:11, border:'1px solid var(--border)', borderRadius:6,
                      padding:'4px 6px', background:'var(--surface)',
                      color:'var(--text-secondary)', outline:'none', fontFamily:'inherit' }}/>
                  <button type="button" onClick={() => setCompSubtasks(p => p.filter((_,xi) => xi!==i))}
                    style={{ background:'none', border:'none', cursor:'pointer', padding:4,
                      color:'#94a3b8', display:'flex', alignItems:'center', borderRadius:4 }}>
                    <Trash2 style={{ width:12, height:12 }}/>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        <button type="button" onClick={() => setCompSubtasks(p => [...p, { title:'', required:false }])}
          style={{ display:'flex', alignItems:'center', gap:5, fontSize:11,
            color:'var(--brand)', background:'none', border:'none', cursor:'pointer',
            padding:'2px 0', fontFamily:'inherit' }}>
          <ListPlus style={{ width:12, height:12 }}/> Add subtask
        </button>
      </div>

      {/* Action row */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:8,
        padding:'8px 14px 10px', borderTop:'1px solid var(--border-light)' }}>
        {/* Require attachment toggle */}
        <button type="button" onClick={() => setRequireAttachment(v => !v)}
          style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px',
            borderRadius:20, border: requireAttachment ? '1px solid #0d9488' : '1px solid var(--border)',
            background: requireAttachment ? 'rgba(13,148,136,0.08)' : 'var(--surface-subtle)',
            cursor:'pointer', fontSize:11, color: requireAttachment ? 'var(--brand)' : 'var(--text-muted)',
            fontFamily:'inherit', fontWeight: requireAttachment ? 600 : 400, flexShrink:0 }}>
          {requireAttachment
            ? <ToggleRight style={{ width:14, height:14, color:'var(--brand)' }}/>
            : <ToggleLeft  style={{ width:14, height:14 }}/>}
          Require attachment on complete
        </button>
        <span style={{ fontSize:11, color:'var(--text-muted)', flex:1 }}>
          {title.trim() ? '' : 'Enter a task name to save'}
        </span>
        <button onClick={close} style={{ padding:'5px 12px', borderRadius:20,
          border:'1px solid var(--border)', background:'transparent',
          color:'var(--text-secondary)', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
          Cancel
        </button>
        <button onClick={save} disabled={saving || !title.trim()}
          style={{ padding:'6px 18px', borderRadius:20, border:'none',
            background: title.trim() ? 'var(--brand)' : '#cbd5e1',
            color: title.trim() ? '#fff' : '#94a3b8',
            fontSize:12, fontWeight:700, cursor: title.trim() ? 'pointer' : 'not-allowed',
            transition:'all 0.15s', opacity: saving ? 0.7 : 1, fontFamily:'inherit',
            boxShadow: title.trim() ? '0 2px 8px rgba(13,148,136,0.35)' : 'none' }}>
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add task'}
        </button>
      </div>
    </div>

    {/* ── Frequency Picker Modal ─────────────────────────────── */}
    {freqModalOpen && (
      <div style={{ position:'fixed', inset:0, zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center',
        background:'rgba(0,0,0,0.35)', backdropFilter:'blur(4px)' }}
        onClick={e => { if (e.target === e.currentTarget) setFreqModalOpen(false) }}>
        <div style={{ background:'var(--surface)', borderRadius:16, padding:'24px 24px 20px',
          width:440, maxWidth:'calc(100vw - 32px)',
          boxShadow:'0 20px 60px rgba(0,0,0,0.18)', border:'1px solid var(--border)' }}>

          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
            <h3 style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)', margin:0 }}>Set Reminder Schedule</h3>
            <button type="button" onClick={() => setFreqModalOpen(false)}
              style={{ background:'var(--surface-subtle)', border:'1px solid var(--border)', cursor:'pointer',
                color:'var(--text-muted)', borderRadius:8, width:28, height:28, display:'flex',
                alignItems:'center', justifyContent:'center' }}>
              <X style={{ width:13, height:13 }}/>
            </button>
          </div>

          {/* Options */}
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>

            {/* 1 — Daily */}
            <label style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:10, cursor:'pointer',
              border:`1.5px solid ${draftType==='daily' ? 'var(--brand)' : 'var(--border)'}`,
              background: draftType==='daily' ? 'var(--brand-light)' : 'var(--surface-subtle)' }}>
              <input type="radio" name="freq" checked={draftType==='daily'} onChange={() => setDraftType('daily')}
                style={{ accentColor:'var(--brand)', width:15, height:15, flexShrink:0 }}/>
              <span style={{ fontSize:13, fontWeight:500, color:'var(--text-primary)' }}>Daily</span>
            </label>

            {/* 2 — Every N days */}
            <label style={{ display:'flex', alignItems:'center', gap:8, padding:'12px 14px', borderRadius:10, cursor:'pointer',
              border:`1.5px solid ${draftType==='every_n_days' ? 'var(--brand)' : 'var(--border)'}`,
              background: draftType==='every_n_days' ? 'var(--brand-light)' : 'var(--surface-subtle)' }}
              onClick={() => setDraftType('every_n_days')}>
              <input type="radio" name="freq" checked={draftType==='every_n_days'} onChange={() => setDraftType('every_n_days')}
                style={{ accentColor:'var(--brand)', width:15, height:15, flexShrink:0 }}/>
              <span style={{ fontSize:13, fontWeight:500, color:'var(--text-primary)', whiteSpace:'nowrap' }}>Every</span>
              <input type="number" min={1} max={7} value={draftNDays}
                onClick={e => { e.stopPropagation(); setDraftType('every_n_days') }}
                onChange={e => setDraftNDays(Math.max(1, Math.min(7, parseInt(e.target.value) || 1)))}
                style={{ width:48, padding:'3px 6px', borderRadius:6, fontSize:13, fontWeight:600, textAlign:'center',
                  border:`1px solid ${draftType==='every_n_days' ? 'var(--brand-border)' : 'var(--border)'}`,
                  background:'var(--surface)', color:'var(--text-primary)', outline:'none', fontFamily:'inherit' }}/>
              <span style={{ fontSize:13, fontWeight:500, color:'var(--text-primary)', whiteSpace:'nowrap' }}>days</span>
              <span style={{ fontSize:11, color:'var(--text-muted)', marginLeft:'auto' }}>(1–7)</span>
            </label>

            {/* 3 — Every [weekday checkboxes] */}
            <div style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'12px 14px', borderRadius:10, cursor:'pointer',
              border:`1.5px solid ${draftType==='weekly_day' ? 'var(--brand)' : 'var(--border)'}`,
              background: draftType==='weekly_day' ? 'var(--brand-light)' : 'var(--surface-subtle)' }}
              onClick={() => setDraftType('weekly_day')}>
              <input type="radio" name="freq" checked={draftType==='weekly_day'} onChange={() => setDraftType('weekly_day')}
                style={{ accentColor:'var(--brand)', width:15, height:15, flexShrink:0, marginTop:2 }}/>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <span style={{ fontSize:13, fontWeight:500, color:'var(--text-primary)' }}>Every</span>
                <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                  {[['mon','Mon'],['tue','Tue'],['wed','Wed'],['thu','Thu'],['fri','Fri'],['sat','Sat'],['sun','Sun']].map(([v, l]) => {
                    const checked = draftWeekdays.includes(v)
                    return (
                      <button key={v} type="button"
                        onClick={e => {
                          e.stopPropagation(); setDraftType('weekly_day')
                          setDraftWeekdays(prev =>
                            prev.includes(v)
                              ? prev.length > 1 ? prev.filter(d => d !== v) : prev
                              : [...prev, v]
                          )
                        }}
                        style={{ padding:'3px 9px', borderRadius:6, fontSize:12, fontWeight:600,
                          border:`1.5px solid ${checked ? 'var(--brand)' : 'var(--border)'}`,
                          background: checked ? 'var(--brand)' : 'var(--surface)',
                          color: checked ? '#fff' : 'var(--text-secondary)',
                          cursor:'pointer', fontFamily:'inherit' }}>
                        {l}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* 4 — Every N weeks */}
            <label style={{ display:'flex', alignItems:'center', gap:8, padding:'12px 14px', borderRadius:10, cursor:'pointer',
              border:`1.5px solid ${draftType==='every_n_weeks' ? 'var(--brand)' : 'var(--border)'}`,
              background: draftType==='every_n_weeks' ? 'var(--brand-light)' : 'var(--surface-subtle)' }}
              onClick={() => setDraftType('every_n_weeks')}>
              <input type="radio" name="freq" checked={draftType==='every_n_weeks'} onChange={() => setDraftType('every_n_weeks')}
                style={{ accentColor:'var(--brand)', width:15, height:15, flexShrink:0 }}/>
              <span style={{ fontSize:13, fontWeight:500, color:'var(--text-primary)', whiteSpace:'nowrap' }}>Every</span>
              <input type="number" min={2} max={4} value={draftNWeeks}
                onClick={e => { e.stopPropagation(); setDraftType('every_n_weeks') }}
                onChange={e => setDraftNWeeks(Math.max(2, Math.min(4, parseInt(e.target.value) || 2)))}
                style={{ width:48, padding:'3px 6px', borderRadius:6, fontSize:13, fontWeight:600, textAlign:'center',
                  border:`1px solid ${draftType==='every_n_weeks' ? 'var(--brand-border)' : 'var(--border)'}`,
                  background:'var(--surface)', color:'var(--text-primary)', outline:'none', fontFamily:'inherit' }}/>
              <span style={{ fontSize:13, fontWeight:500, color:'var(--text-primary)', whiteSpace:'nowrap' }}>weeks</span>
              <span style={{ fontSize:11, color:'var(--text-muted)', marginLeft:'auto' }}>(2–4)</span>
            </label>

            {/* 5 — On the [day grid] of every month */}
            <div style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'12px 14px', borderRadius:10, cursor:'pointer',
              border:`1.5px solid ${draftType==='monthly_day' ? 'var(--brand)' : 'var(--border)'}`,
              background: draftType==='monthly_day' ? 'var(--brand-light)' : 'var(--surface-subtle)' }}
              onClick={() => setDraftType('monthly_day')}>
              <input type="radio" name="freq" checked={draftType==='monthly_day'} onChange={() => setDraftType('monthly_day')}
                style={{ accentColor:'var(--brand)', width:15, height:15, flexShrink:0, marginTop:2 }}/>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <span style={{ fontSize:13, fontWeight:500, color:'var(--text-primary)' }}>On the ___ of every month</span>
                <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                  {Array.from({ length: 30 }, (_, i) => i + 1).map(day => {
                    const checked = draftMonthDays.includes(day)
                    return (
                      <button key={day} type="button"
                        onClick={e => {
                          e.stopPropagation(); setDraftType('monthly_day')
                          setDraftMonthDays(prev =>
                            prev.includes(day)
                              ? prev.length > 1 ? prev.filter(d => d !== day) : prev
                              : [...prev, day]
                          )
                        }}
                        style={{ width:28, height:28, borderRadius:5, fontSize:11, fontWeight:600,
                          border:`1.5px solid ${checked ? 'var(--brand)' : 'var(--border)'}`,
                          background: checked ? 'var(--brand)' : 'var(--surface)',
                          color: checked ? '#fff' : 'var(--text-secondary)',
                          cursor:'pointer', fontFamily:'inherit' }}>
                        {day}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

          </div>

          {/* Footer buttons */}
          <div style={{ display:'flex', gap:10, marginTop:20 }}>
            <button type="button" onClick={() => setFreqModalOpen(false)}
              style={{ flex:1, padding:'10px 0', borderRadius:10, border:'1px solid var(--border)',
                background:'transparent', color:'var(--text-secondary)', fontSize:13, fontWeight:500,
                cursor:'pointer', fontFamily:'inherit' }}>
              Cancel
            </button>
            <button type="button" onClick={confirmFreqModal}
              style={{ flex:2, padding:'10px 0', borderRadius:10, border:'none',
                background:'var(--brand)', color:'#fff', fontSize:13, fontWeight:700,
                cursor:'pointer', fontFamily:'inherit',
                boxShadow:'0 2px 10px rgba(13,148,136,0.35)' }}>
              Confirm
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

export { FREQ_LABEL }
