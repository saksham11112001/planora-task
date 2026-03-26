'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, RefreshCw, User, Flag, Briefcase, Paperclip } from 'lucide-react'
import { toast } from '@/store/appStore'
import { useTaskFields } from '@/lib/hooks/useTaskFields'

// ── Granular frequency options ─────────────────────────────────
const FREQUENCIES = [
  { group: 'Daily',    v: 'daily',              l: 'Every day' },
  { group: 'Weekly',   v: 'weekly_mon',         l: 'Every Monday' },
  { group: 'Weekly',   v: 'weekly_tue',         l: 'Every Tuesday' },
  { group: 'Weekly',   v: 'weekly_wed',         l: 'Every Wednesday' },
  { group: 'Weekly',   v: 'weekly_thu',         l: 'Every Thursday' },
  { group: 'Weekly',   v: 'weekly_fri',         l: 'Every Friday' },
  { group: 'Weekly',   v: 'bi_weekly',          l: 'Every 2 weeks' },
  { group: 'Monthly',  v: 'monthly_1',          l: '1st of every month' },
  { group: 'Monthly',  v: 'monthly_15',         l: '15th of every month' },
  { group: 'Monthly',  v: 'monthly_last',       l: 'Last day of month' },
  { group: 'Monthly',  v: 'monthly',            l: 'Monthly (same date)' },
  { group: 'Other',    v: 'quarterly',          l: 'Quarterly' },
  { group: 'Other',    v: 'annual',             l: 'Annually' },
]

const FREQ_LABEL: Record<string, string> = Object.fromEntries(FREQUENCIES.map(f => [f.v, f.l]))

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
  editTask?: {
    id: string; title: string; frequency: string; priority: string
    assignee_id: string | null; client_id?: string | null
  }
  onCreated?:    () => void
  onEdited?:     () => void
  onCancelEdit?: () => void
}

export function InlineRecurringTask({ members, clients = [], currentUserId, editTask, onCreated, onEdited, onCancelEdit }: Props) {
  const router   = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const rowRef   = useRef<HTMLDivElement>(null)
  const fileRef  = useRef<HTMLInputElement>(null)

  const isEdit = !!editTask
  const { show, required } = useTaskFields()
  const [errors, setErrors] = useState<Record<string,string>>({})
  const [open,      setOpen]      = useState(isEdit)
  const [saving,    setSaving]    = useState(false)
  const [title,     setTitle]     = useState(editTask?.title ?? '')
  const [frequency, setFrequency] = useState(editTask?.frequency ?? 'weekly_mon')
  const [priority,  setPriority]  = useState(editTask?.priority ?? 'medium')
  const [assignee,  setAssignee]  = useState(editTask?.assignee_id ?? currentUserId ?? '')
  const [clientId,  setClientId]  = useState(editTask?.client_id ?? '')
  const [files,     setFiles]     = useState<File[]>([])

  useEffect(() => {
    if (open && !isEdit) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open, isEdit])

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (rowRef.current && !rowRef.current.contains(e.target as Node) && !title.trim()) close()
  }, [title])

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [handleClickOutside])

  function close() {
    if (isEdit) { onCancelEdit?.(); return }
    setOpen(false); setTitle(''); setFrequency('weekly_mon'); setPriority('medium')
    setClientId(''); setAssignee(currentUserId ?? ''); setFiles([])
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
      const body = {
        title: title.trim(), frequency, priority,
        assignee_id: assignee  || null,
        client_id:   clientId  || null,
        start_date:  new Date().toISOString().split('T')[0],
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

      toast.success(isEdit ? 'Updated ✓' : 'Recurring task created ✓')
      if (isEdit) { onEdited?.(); return }
      close()
      onCreated ? onCreated() : router.refresh()
    } finally { setSaving(false) }
  }

  const priConf = PRIORITY_OPTIONS.find(p => p.value === priority) ?? PRIORITY_OPTIONS[2]

  if (!open) {
    return (
      <div onClick={() => setOpen(true)} style={{
        display:'flex', alignItems:'center', gap:8, padding:'10px 20px',
        cursor:'pointer', borderTop:'1px dashed var(--border)', color:'var(--text-muted)',
        transition:'all 0.15s', userSelect:'none',
      }}
      onMouseEnter={e=>{(e.currentTarget as any).style.color='var(--brand)';(e.currentTarget as any).style.background='var(--brand-light)'}}
      onMouseLeave={e=>{(e.currentTarget as any).style.color='var(--text-muted)';(e.currentTarget as any).style.background='transparent'}}>
        <Plus style={{ width:14, height:14, flexShrink:0 }}/>
        <span style={{ fontSize:13 }}>Add recurring task</span>
      </div>
    )
  }

  return (
    <div ref={rowRef} style={{
      margin:'6px 12px 10px', borderRadius:10,
      border:'1.5px solid var(--brand-border)',
      background:'var(--surface)',
      boxShadow:'0 2px 12px rgba(13,148,136,0.08)',
      overflow:'hidden',
    }}>
      {/* Title row */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px 8px' }}>
        <RefreshCw style={{ width:13, height:13, color:'var(--brand)', flexShrink:0 }}/>
        <input ref={inputRef} value={title} onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key==='Enter') save(); if (e.key==='Escape') close() }}
          placeholder="Recurring task name…"
          style={{ flex:1, fontSize:14, fontWeight:500, border:'none', outline:'none',
            background:'transparent', color:'var(--text-primary)' }}/>
        <button onClick={close} style={{ background:'none', border:'none', cursor:'pointer',
          color:'var(--text-muted)', display:'flex', padding:2, borderRadius:4 }}>
          <X style={{ width:13, height:13 }}/>
        </button>
      </div>

      <div style={{ height:1, background:'var(--border-light)', margin:'0 14px' }}/>

      {/* Options pills */}
      <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px 10px', flexWrap:'wrap' }}>

        {/* Frequency — grouped select */}
        <label style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px',
          borderRadius:20, border:'1.5px solid var(--brand-border)',
          background:'var(--brand-light)', cursor:'pointer' }}>
          <RefreshCw style={{ width:10, height:10, color:'var(--brand)', flexShrink:0 }}/>
          <select value={frequency} onChange={e => setFrequency(e.target.value)}
            style={{ fontSize:12, border:'none', outline:'none',
              background:'transparent', color:'var(--brand)',
              cursor:'pointer', appearance:'none', fontWeight:500 }}>
            {(['Daily','Weekly','Monthly','Other'] as const).map(group => (
              <optgroup key={group} label={group}>
                {FREQUENCIES.filter(f => f.group === group).map(f => (
                  <option key={f.v} value={f.v}>{f.l}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

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
        {show('client') && clients.length > 0 && (
          <label style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px',
            borderRadius:20,
            border: clientId ? `1px solid ${clients.find(c=>c.id===clientId)?.color ?? '#0d9488'}55` : '1px solid var(--border)',
            background: clientId ? `${clients.find(c=>c.id===clientId)?.color ?? '#0d9488'}14` : 'var(--surface-subtle)',
            cursor:'pointer' }}>
            {clientId
              ? <span style={{ width:8, height:8, borderRadius:2, flexShrink:0,
                  background:clients.find(c=>c.id===clientId)?.color??'#0d9488', display:'inline-block' }}/>
              : <Briefcase style={{ width:11, height:11, color:'var(--text-muted)', flexShrink:0 }}/>
            }
            <select value={clientId} onChange={e => setClientId(e.target.value)}
              style={{ fontSize:12, border:'none', outline:'none',
                background:'transparent',
                color: clientId ? (clients.find(c=>c.id===clientId)?.color??'#0d9488') : 'var(--text-secondary)',
                cursor:'pointer', appearance:'none', fontWeight: clientId?600:400 }}>
              <option value="">Client…</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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

        {/* Errors */}
        {Object.values(errors).some(Boolean) && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:4, width:'100%', paddingTop:4 }}>
            {Object.entries(errors).filter(([,v]) => v).map(([k, v]) => (
              <span key={k} style={{ fontSize:11, color:'#dc2626', background:'#fef2f2', padding:'2px 8px', borderRadius:99 }}>{v}</span>
            ))}
          </div>
        )}
        {/* Save */}
        <button onClick={save} disabled={saving || !title.trim()}
          style={{ marginLeft:'auto', padding:'5px 16px', borderRadius:20, border:'none',
            background: title.trim() ? 'var(--brand)' : 'var(--border)',
            color: title.trim() ? '#fff' : 'var(--text-muted)',
            fontSize:12, fontWeight:600, cursor: title.trim() ? 'pointer' : 'default',
            transition:'all 0.15s', flexShrink:0, opacity: saving ? 0.7 : 1,
            fontFamily:'inherit' }}>
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add task'}
        </button>
      </div>
    </div>
  )
}

export { FREQ_LABEL }
