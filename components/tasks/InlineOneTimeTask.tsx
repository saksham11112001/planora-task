'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, User, Flag, Calendar, Shield, Briefcase, Paperclip, AlertCircle, ToggleLeft, ToggleRight, ListPlus, Trash2 } from 'lucide-react'
import { toast } from '@/store/appStore'
import { useOrgSettings } from '@/lib/hooks/useOrgSettings'
import { InlineCustomFields }    from '@/components/tasks/InlineCustomFields'
import { QuickAddClientModal }    from '@/components/clients/QuickAddClientModal'

interface Member { id: string; name: string; role?: string }

interface Props {
  members:        Member[]
  clients:        { id: string; name: string; color: string }[]
  currentUserId?: string
  onCreated?:     (task?: any) => void
}

const PRIORITY_OPTIONS = [
  { value: 'none',   label: 'No priority', color: '#94a3b8' },
  { value: 'low',    label: 'Low',         color: '#16a34a' },
  { value: 'medium', label: 'Medium',      color: '#ca8a04' },
  { value: 'high',   label: 'High',        color: '#ea580c' },
  { value: 'urgent', label: 'Urgent',      color: '#dc2626' },
]

export function InlineOneTimeTask({ members, clients, currentUserId, onCreated }: Props) {
  const router   = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const rowRef   = useRef<HTMLDivElement>(null)
  const fileRef  = useRef<HTMLInputElement>(null)
  const { customFields, taskFields } = useOrgSettings()
  const show     = (key: string) => taskFields[key]?.visible !== false
  const required = (key: string) => taskFields[key]?.mandatory === true

  const [open,       setOpen]       = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [title,      setTitle]      = useState('')
  const [assignee,   setAssignee]   = useState(currentUserId ?? '')
  const [coAssignees,   setCoAssignees]   = useState<string[]>([])
  const [makeRecurring, setMakeRecurring] = useState(false)
  const [recurringFreq, setRecurringFreq] = useState('weekly')
  const [addToProjectId, setAddToProjectId] = useState('')
  const [priority,   setPriority]   = useState('medium')
  const [dueDate,    setDueDate]    = useState('')
  const [clientId,   setClientId]   = useState('')
  const [approverId, setApproverId] = useState('')
  const [files,      setFiles]      = useState<File[]>([])
  const [errors,       setErrors]       = useState<Record<string,string>>({})
  const [customValues,  setCustomValues]  = useState<Record<string,any>>({})
  const [showAddClient, setShowAddClient] = useState(false)
  const [clientList,      setClientList]      = useState(clients)
  const [requireAttachment, setRequireAttachment] = useState(false)
  const [compSubtasks, setCompSubtasks] = useState<{title:string;required:boolean;due_date?:string;assignee_id?:string}[]>([])
  const [projectsList, setProjectsList] = useState<{id: string; name: string; color: string}[]>([])

  const approvers = members.filter(m => m.role && ['owner','admin','manager'].includes(m.role))
  const priConf   = PRIORITY_OPTIONS.find(p => p.value === priority) ?? PRIORITY_OPTIONS[2]

  function reset() {
    setOpen(false); setTitle(''); setAssignee(currentUserId ?? '')
    setPriority('medium'); setDueDate(''); setClientId('')
    setApproverId(''); setFiles([]); setErrors({})
    setCoAssignees([]); setMakeRecurring(false); setRecurringFreq('weekly'); setAddToProjectId('')
    setRequireAttachment(false); setCompSubtasks([])
  }

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (rowRef.current && !rowRef.current.contains(e.target as Node)) {
      if (!title.trim()) reset()
    }
  }, [title])

  useEffect(() => {
    if (!open) return  // only listen when form is actually open
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open, handleClickOutside])

  useEffect(() => {
    if (!open) return
    fetch('/api/projects?limit=100')
      .then(r => r.json())
      .then(j => setProjectsList(Array.isArray(j) ? j : (j.data ?? [])))
      .catch(() => {})
  }, [open])

  function openRow() { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }

  function validate(): boolean {
    const errs: Record<string,string> = {}
    if (!title.trim()) { errs.title = 'Title is required'; inputRef.current?.focus(); setErrors(errs); return false }
    if (required('assignee')   && !assignee)   errs.assignee   = 'Assignee is required'
    if (required('due_date')   && !dueDate)    errs.due_date   = 'Due date is required'
    if (required('client')     && !clientId)   errs.client     = 'Client is required'
    if (required('approver')   && !approverId) errs.approver   = 'Approver is required'
    if (required('attachment') && files.length === 0) errs.attachment = 'Attachment is required'
    // Custom field mandatory checks not applicable inline (filled in detail panel)
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function save() {
    if (!validate()) return
    setSaving(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:             title.trim(),
          assignee_id:       assignee     || null,
          priority,
          due_date:          dueDate      || null,
          client_id:         clientId     || null,
          approver_id:       approverId   || null,
          approval_required: !!approverId,
          is_recurring:      makeRecurring || undefined,
          frequency:         makeRecurring ? recurringFreq : undefined,
          project_id:        addToProjectId || undefined,
          custom_fields:     {
            ...(Object.keys(customValues).length > 0 ? customValues : {}),
            ...(coAssignees.length > 0 ? { _co_assignees: coAssignees } : {}),
            ...(requireAttachment ? { _require_attachment: true } : {}),
          },
          subtasks: compSubtasks.filter(s => s.title.trim()).map(s => ({
            title:       s.title.trim(),
            required:    s.required,
            due_date:    s.due_date,
            assignee_id: s.assignee_id || null,
          })),
        }),
      })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error ?? 'Failed'); return }

      // Upload attachments if any
      if (files.length > 0 && d.data?.id) {
        const fd = new FormData()
        files.forEach(f => fd.append('files', f))
        await fetch(`/api/tasks/${d.data.id}/attachments`, { method: 'POST', body: fd })
      }

      toast.success('Task created')
      reset()
      onCreated ? onCreated(d.data) : router.refresh()
    } finally { setSaving(false) }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() }
    if (e.key === 'Escape') reset()
  }

  if (!open) {
    return (
      <>
        <div onClick={openRow} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px',
          cursor: 'pointer', borderTop: '1px dashed var(--border)', color: 'var(--text-muted)',
          transition: 'all 0.15s', userSelect: 'none',
        }}
        onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'var(--brand)'; el.style.background = 'var(--brand-light)' }}
        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'var(--text-muted)'; el.style.background = 'transparent' }}>
          <div style={{ width: 18, height: 18, borderRadius: '50%', border: '1.5px dashed currentColor',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Plus style={{ width: 10, height: 10 }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Add task</span>
          <span style={{ fontSize: 10, opacity: 0.5, marginLeft: 'auto' }}>↵ Enter</span>
        </div>
      </>
    )
  }

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
    <div ref={rowRef} style={{
      margin: '6px 12px 10px', borderRadius: 10,
      border: '1.5px solid var(--brand-border)',
      background: 'var(--surface)',
      boxShadow: '0 2px 12px rgba(13,148,136,0.08)', overflow: 'hidden',
    }}>
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px 8px' }}>
        <div style={{ width: 15, height: 15, borderRadius: '50%', flexShrink: 0, border: '2px solid var(--brand)', opacity: 0.5 }} />
        <input ref={inputRef} value={title} onChange={e => setTitle(e.target.value)} onKeyDown={onKeyDown}
          placeholder="Task name…"
          style={{ flex: 1, fontSize: 14, fontWeight: 500, border: 'none', outline: 'none',
            background: 'transparent', color: 'var(--text-primary)', fontFamily: 'inherit' }}/>
        <button onClick={reset} style={{ background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', display: 'flex', padding: 2, borderRadius: 4 }}>
          <X style={{ width: 13, height: 13 }} />
        </button>
      </div>

      <div style={{ height: 1, background: 'var(--border-light)', margin: '0 14px' }} />

      {/* Pills row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px 4px', flexWrap: 'wrap' }}>

        {/* Assignee */}
        {show('assignee') && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20,
            border: `1px solid ${errors.assignee ? '#fca5a5' : 'var(--border)'}`,
            background: errors.assignee ? '#fef2f2' : 'var(--surface-subtle)', cursor: 'pointer' }}>
            <User style={{ width: 11, height: 11, color: errors.assignee ? '#dc2626' : 'var(--brand)', flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', flexShrink: 0, letterSpacing: '0.02em' }}>Assignee</span>
            <span style={{ fontSize: 11, color: 'var(--border)', flexShrink: 0 }}>·</span>
            <select value={assignee} onChange={e => { setAssignee(e.target.value); setErrors(p => ({ ...p, assignee: '' })) }}
              style={{ fontSize: 12, border: 'none', outline: 'none', background: 'transparent',
                color: assignee ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: assignee ? 500 : 400,
                cursor: 'pointer', appearance: 'none', fontFamily: 'inherit' }}>
              <option value="">Unassigned{required('assignee') ? ' *' : ''}</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}{m.id === currentUserId ? ' (me)' : ''}</option>)}
            </select>
          </label>
        )}

        {/* Co-assignees multi-select */}
        {members.length > 1 && (
          <div style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px',
            borderRadius:20, border: coAssignees.length > 0 ? '1.5px solid var(--brand)' : '1px solid var(--border)',
            background: coAssignees.length > 0 ? 'var(--brand-light)' : 'var(--surface-subtle)', flexWrap:'wrap', maxWidth:240 }}>
            <User style={{ width:11, height:11, color: coAssignees.length>0?'var(--brand)':'var(--text-muted)', flexShrink:0 }}/>
            <span style={{ fontSize:11, color: coAssignees.length>0?'var(--brand)':'var(--text-muted)', fontWeight:600, flexShrink:0 }}>
              {coAssignees.length > 0 ? `+${coAssignees.length} co-assignee${coAssignees.length>1?'s':''}` : 'Add co-assignee'}
            </span>
            {members.filter(m => m.id !== assignee).map(m => (
              <button key={m.id} type="button"
                onClick={() => setCoAssignees(p => p.includes(m.id) ? p.filter(id=>id!==m.id) : [...p, m.id])}
                style={{ fontSize:10, padding:'1px 7px', borderRadius:99, border:'none', cursor:'pointer',
                  background: coAssignees.includes(m.id) ? 'var(--brand)' : '#e2e8f0',
                  color: coAssignees.includes(m.id) ? '#fff' : '#374151',
                  fontFamily:'inherit', fontWeight:600, flexShrink:0 }}>
                {m.name.split(' ')[0]}
              </button>
            ))}
          </div>
        )}

        {/* Priority */}
        {show('priority') && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20,
            border: `1px solid ${priConf.color}44`, background: `${priConf.color}18`, cursor: 'pointer' }}>
            <Flag style={{ width: 11, height: 11, color: priConf.color, flexShrink: 0 }} />
            <select value={priority} onChange={e => setPriority(e.target.value)}
              style={{ fontSize: 12, border: 'none', outline: 'none', background: 'transparent',
                color: priConf.color, cursor: 'pointer', appearance: 'none', fontWeight: 500, fontFamily: 'inherit' }}>
              {PRIORITY_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        )}

        {/* Due date */}
        {show('due_date') && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20,
            border: `1px solid ${errors.due_date ? '#fca5a5' : 'var(--border)'}`,
            background: errors.due_date ? '#fef2f2' : 'var(--surface-subtle)', cursor: 'pointer' }}>
            <Calendar style={{ width: 11, height: 11, color: errors.due_date ? '#dc2626' : 'var(--text-muted)', flexShrink: 0 }} />
            <input type="date" value={dueDate} onChange={e => { setDueDate(e.target.value); setErrors(p => ({ ...p, due_date: '' })) }}
              style={{ fontSize: 12, border: 'none', outline: 'none', background: 'transparent',
                color: dueDate ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer',
                colorScheme: 'light dark', width: dueDate ? 'auto' : 80, fontFamily: 'inherit' }}
              placeholder={required('due_date') ? 'Due date *' : 'Due date'}/>
          </label>
        )}

        {/* Client */}
        {show('client') && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20,
            border: errors.client ? '1px solid #fca5a5' : clientId
              ? `1px solid ${clientList.find(c => c.id === clientId)?.color ?? '#0d9488'}55`
              : '1px solid var(--border)',
            background: errors.client ? '#fef2f2' : clientId
              ? `${clients.find(c => c.id === clientId)?.color ?? '#0d9488'}14`
              : 'var(--surface-subtle)', cursor: 'pointer' }}>
            {clientId
              ? <span style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0,
                  background: clientList.find(c => c.id === clientId)?.color ?? '#0d9488', display: 'inline-block' }}/>
              : <Briefcase style={{ width: 11, height: 11, color: errors.client ? '#dc2626' : 'var(--text-muted)', flexShrink: 0 }} />
            }
            {clients.length === 0
              ? <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No clients</span>
              : <select value={clientId} onChange={e => {
                    if (e.target.value === '__add__') { setShowAddClient(true) }
                    else { setClientId(e.target.value); setErrors(p => ({ ...p, client: '' })) }
                  }}
                  style={{ fontSize: 12, border: 'none', outline: 'none', background: 'transparent',
                    color: clientId ? (clientList.find(c => c.id === clientId)?.color ?? '#0d9488') : 'var(--text-secondary)',
                    cursor: 'pointer', appearance: 'none', fontWeight: clientId ? 600 : 400, fontFamily: 'inherit' }}>
                  <option value="">Client{required('client') ? ' *' : '…'}</option>
                  {clientList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  <option value="__add__">+ Add new client…</option>
                </select>
            }
          </label>
        )}

        {/* Approver */}
        {show('approver') && approvers.length > 0 && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20,
            border: errors.approver ? '1px solid #fca5a5' : approverId ? '1px solid #7c3aed44' : '1px solid var(--border)',
            background: errors.approver ? '#fef2f2' : approverId ? '#7c3aed12' : 'var(--surface-subtle)', cursor: 'pointer' }}>
            <Shield style={{ width: 11, height: 11, color: errors.approver ? '#dc2626' : approverId ? '#7c3aed' : 'var(--text-muted)', flexShrink: 0 }} />
            <select value={approverId} onChange={e => { setApproverId(e.target.value); setErrors(p => ({ ...p, approver: '' })) }}
              style={{ fontSize: 12, border: 'none', outline: 'none', background: 'transparent',
                color: approverId ? '#7c3aed' : 'var(--text-secondary)', cursor: 'pointer',
                appearance: 'none', fontWeight: approverId ? 500 : 400, fontFamily: 'inherit' }}>
              <option value="">Approver{required('approver') ? ' *' : ''}</option>
              {approvers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
        )}

        {/* Attachment */}
        {show('attachment') && (
          <button onClick={() => fileRef.current?.click()}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20,
              border: errors.attachment ? '1px solid #fca5a5' : files.length > 0 ? '1px solid var(--brand-border)' : '1px solid var(--border)',
              background: errors.attachment ? '#fef2f2' : files.length > 0 ? 'var(--brand-light)' : 'var(--surface-subtle)',
              color: errors.attachment ? '#dc2626' : files.length > 0 ? 'var(--brand)' : 'var(--text-secondary)',
              fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Paperclip style={{ width: 11, height: 11 }}/>
            {files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''}` : required('attachment') ? 'Attach *' : 'Attach'}
          </button>
        )}
        <input ref={fileRef} type="file" multiple style={{ display: 'none' }}
          onChange={e => { setFiles(Array.from(e.target.files ?? [])); setErrors(p => ({ ...p, attachment: '' })) }}/>

        {/* Require attachment on complete toggle */}
        <button type="button" onClick={() => setRequireAttachment(p => !p)}
          style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:20,
            border: requireAttachment ? '1.5px solid #dc2626' : '1px solid var(--border)',
            background: requireAttachment ? '#fef2f2' : 'var(--surface-subtle)',
            color: requireAttachment ? '#dc2626' : 'var(--text-secondary)',
            fontSize:12, cursor:'pointer', fontFamily:'inherit', fontWeight: requireAttachment ? 700 : 400 }}>
          {requireAttachment
            ? <ToggleRight style={{ width:13, height:13 }}/>
            : <ToggleLeft  style={{ width:13, height:13 }}/>}
          Require attachment on complete
        </button>

        {/* Custom fields */}
        {customFields.length > 0 && (
          <InlineCustomFields
            defs={customFields}
            values={customValues}
            onChange={(k, v) => setCustomValues(p => ({ ...p, [k]: v }))}
          />
        )}

        {/* Subtasks — per-subtask assignee + date */}
        <div style={{ width:'100%', marginTop:4 }}>
          {compSubtasks.length > 0 && (
            <div style={{ padding:'8px 12px', borderRadius:8, marginBottom:6,
              background:'rgba(13,148,136,0.04)', border:'1px solid rgba(13,148,136,0.2)' }}>
              <p style={{ fontSize:10, fontWeight:700, color:'var(--brand)', marginBottom:8,
                textTransform:'uppercase', letterSpacing:'0.06em' }}>
                Subtasks
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {compSubtasks.map((s, i) => (
                  <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr auto auto auto', gap:6, alignItems:'center' }}>
                    <input value={s.title}
                      onChange={e => setCompSubtasks(p => p.map((x, xi) => xi===i ? { ...x, title:e.target.value } : x))}
                      placeholder="Subtask name…"
                      style={{ fontSize:12, padding:'4px 8px', borderRadius:6, border:'1px solid var(--border)',
                        outline:'none', background:'var(--surface)', color:'var(--text-primary)', fontFamily:'inherit' }}/>
                    <select value={s.assignee_id ?? ''}
                      onChange={e => setCompSubtasks(p => p.map((x, xi) => xi===i ? { ...x, assignee_id:e.target.value||undefined } : x))}
                      style={{ fontSize:11, padding:'4px 8px', borderRadius:6, border:'1px solid var(--border)',
                        outline:'none', background:'var(--surface)', color:'var(--text-secondary)', fontFamily:'inherit', cursor:'pointer' }}>
                      <option value="">Assignee (same as task)</option>
                      {members.map(m => <option key={m.id} value={m.id}>{m.name}{m.id===currentUserId?' (me)':''}</option>)}
                    </select>
                    <input type="date" value={s.due_date ?? ''}
                      onChange={e => setCompSubtasks(p => p.map((x, xi) => xi===i ? { ...x, due_date:e.target.value||undefined } : x))}
                      style={{ fontSize:11, padding:'4px 6px', borderRadius:6, border:'1px solid var(--border)',
                        outline:'none', background:'var(--surface)', color:'var(--text-secondary)',
                        colorScheme:'light dark', fontFamily:'inherit' }}/>
                    <button onClick={() => setCompSubtasks(p => p.filter((_,xi) => xi!==i))}
                      style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:3, display:'flex' }}>
                      <Trash2 style={{ width:12, height:12 }}/>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <button type="button"
            onClick={() => setCompSubtasks(p => [...p, { title:'', required:false }])}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:20,
              border:'1px dashed var(--brand-border)', background:'transparent',
              color:'var(--brand)', fontSize:11, fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>
            <ListPlus style={{ width:12, height:12 }}/> Add subtask
          </button>
        </div>

        {/* Make recurring / add to project pills */}
        <button type="button"
          onClick={() => { setMakeRecurring(p => !p); if (addToProjectId) setAddToProjectId('') }}
          style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px',
            borderRadius:20, border: makeRecurring ? '1.5px solid #0d9488' : '1px solid var(--border)',
            background: makeRecurring ? '#f0fdfa' : 'var(--surface-subtle)',
            cursor:'pointer', fontSize:12, color: makeRecurring ? '#0d9488' : 'var(--text-secondary)',
            fontWeight: makeRecurring ? 700 : 400, fontFamily:'inherit' }}>
          🔁 {makeRecurring ? 'Recurring ✓' : 'Make recurring'}
        </button>
        {makeRecurring && (
          <select value={recurringFreq} onChange={e => setRecurringFreq(e.target.value)}
            style={{ fontSize:12, padding:'4px 8px', borderRadius:20, border:'1.5px solid #0d9488',
              background:'#f0fdfa', color:'#0d9488', fontWeight:600, outline:'none', cursor:'pointer',
              fontFamily:'inherit' }}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="bi_weekly">Every 2 weeks</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annual">Annual</option>
          </select>
        )}
        {!makeRecurring && (
          <label style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px',
            borderRadius:20, border: addToProjectId ? '1.5px solid #7c3aed' : '1px solid var(--border)',
            background: addToProjectId ? '#faf5ff' : 'var(--surface-subtle)', cursor:'pointer' }}>
            <span style={{ fontSize:11 }}>📁</span>
            <select
              value={addToProjectId}
              onChange={e => setAddToProjectId(e.target.value)}
              style={{ fontSize:12, border:'none', outline:'none', background:'transparent',
                color: addToProjectId ? '#7c3aed' : 'var(--text-secondary)',
                cursor:'pointer', appearance:'none', fontWeight: addToProjectId ? 600 : 400,
                fontFamily:'inherit', maxWidth:130 }}>
              <option value="">Project…</option>
              {projectsList.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
        )}

        {/* Save */}
        <button onClick={save} disabled={saving || !title.trim()}
          style={{ marginLeft: 'auto', padding: '5px 16px', borderRadius: 20, border: 'none',
            background: title.trim() ? 'var(--brand)' : 'var(--border)',
            color: title.trim() ? '#fff' : 'var(--text-muted)',
            fontSize: 12, fontWeight: 600, cursor: title.trim() ? 'pointer' : 'default',
            transition: 'all 0.15s', flexShrink: 0, opacity: saving ? 0.7 : 1, fontFamily: 'inherit' }}>
          {saving ? 'Saving…' : 'Add task'}
        </button>
      </div>

      {/* Validation errors */}
      {Object.values(errors).some(Boolean) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '4px 14px 8px' }}>
          {Object.entries(errors).filter(([,v]) => v).map(([k, v]) => (
            <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 11, color: '#dc2626', background: '#fef2f2',
              padding: '2px 8px', borderRadius: 99 }}>
              <AlertCircle style={{ width: 10, height: 10 }}/> {v}
            </span>
          ))}
        </div>
      )}
    </div>
    </>
  )
}
