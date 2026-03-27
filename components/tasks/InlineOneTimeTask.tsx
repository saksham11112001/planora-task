'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, User, Flag, Calendar, Shield, Briefcase, Paperclip, AlertCircle } from 'lucide-react'
import { toast } from '@/store/appStore'
import { useOrgSettings } from '@/lib/hooks/useOrgSettings'
import { InlineCustomFields }    from '@/components/tasks/InlineCustomFields'
import { QuickAddClientModal }    from '@/components/clients/QuickAddClientModal'
import { ComplianceTaskPicker }   from '@/components/tasks/ComplianceTaskPicker'
import type { ComplianceTask }    from '@/lib/data/complianceTasks'

interface Member { id: string; name: string; role?: string }

interface Props {
  members:        Member[]
  clients:        { id: string; name: string; color: string }[]
  currentUserId?: string
  onCreated?:     () => void
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
  const { customFields, taskFields, caComplianceMode, loading: settingsLoading } = useOrgSettings()
  const show     = (key: string) => taskFields[key]?.visible !== false
  const required = (key: string) => taskFields[key]?.mandatory === true

  const [open,       setOpen]       = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [title,      setTitle]      = useState('')
  const [assignee,   setAssignee]   = useState(currentUserId ?? '')
  const [priority,   setPriority]   = useState('medium')
  const [dueDate,    setDueDate]    = useState('')
  const [clientId,   setClientId]   = useState('')
  const [approverId, setApproverId] = useState('')
  const [files,      setFiles]      = useState<File[]>([])
  const [errors,       setErrors]       = useState<Record<string,string>>({})
  const [customValues,  setCustomValues]  = useState<Record<string,any>>({})
  const [showAddClient, setShowAddClient] = useState(false)
  const [clientList,      setClientList]      = useState(clients)
  const [compSubtasks,   setCompSubtasks]   = useState<{title:string;required:boolean;due_date?:string}[]>([])

  function handleComplianceSelect(task: ComplianceTask) {
    setTitle(task.title)
    setPriority(task.priority)
    setCompSubtasks(task.subtasks)
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const approvers = members.filter(m => m.role && ['owner','admin','manager'].includes(m.role))
  const priConf   = PRIORITY_OPTIONS.find(p => p.value === priority) ?? PRIORITY_OPTIONS[2]

  function reset() {
    setOpen(false); setTitle(''); setAssignee(currentUserId ?? '')
    setPriority('medium'); setDueDate(''); setClientId('')
    setApproverId(''); setFiles([]); setErrors({})
  }

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (rowRef.current && !rowRef.current.contains(e.target as Node)) {
      if (!title.trim()) reset()
    }
  }, [title])

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [handleClickOutside])

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
          custom_fields:     Object.keys(customValues).length > 0 ? customValues : undefined,
          subtasks:          compSubtasks.length > 0 ? compSubtasks.map(s => ({ title: s.title, required: s.required })) : undefined,
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
      onCreated ? onCreated() : router.refresh()
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
          <Plus style={{ width: 14, height: 14, flexShrink: 0 }} />
          <span style={{ fontSize: 13 }}>Add task</span>
        </div>
        {caComplianceMode && (
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 14px',
            background:'rgba(13,148,136,0.05)', borderTop:'1px solid var(--border-light)' }}>
            <ComplianceTaskPicker onSelect={handleComplianceSelect}/>
            <span style={{ fontSize:11, color:'var(--text-muted)' }}>or pick a CA compliance task</span>
          </div>
        )}
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
            <User style={{ width: 11, height: 11, color: errors.assignee ? '#dc2626' : 'var(--text-muted)', flexShrink: 0 }} />
            <select value={assignee} onChange={e => { setAssignee(e.target.value); setErrors(p => ({ ...p, assignee: '' })) }}
              style={{ fontSize: 12, border: 'none', outline: 'none', background: 'transparent',
                color: 'var(--text-secondary)', cursor: 'pointer', appearance: 'none', fontFamily: 'inherit' }}>
              <option value="">Unassigned{required('assignee') ? ' *' : ''}</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}{m.id === currentUserId ? ' (me)' : ''}</option>)}
            </select>
          </label>
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

        {/* Custom fields */}
        {customFields.length > 0 && (
          <InlineCustomFields
            defs={customFields}
            values={customValues}
            onChange={(k, v) => setCustomValues(p => ({ ...p, [k]: v }))}
          />
        )}

        {/* Compliance subtasks preview */}
        {compSubtasks.length > 0 && (
          <div style={{ width:'100%', marginTop:6, padding:'8px 12px', borderRadius:8,
            background:'rgba(13,148,136,0.06)', border:'1px solid rgba(13,148,136,0.25)' }}>
            <p style={{ fontSize:10, fontWeight:700, color:'var(--brand)', marginBottom:8,
              textTransform:'uppercase', letterSpacing:'0.06em' }}>
              📎 Subtasks — set individual due dates
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {compSubtasks.map((s,i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                  <span style={{ fontSize:11, padding:'3px 10px', borderRadius:99, flexShrink:0,
                    background: s.required ? 'rgba(13,148,136,0.12)' : 'var(--surface-subtle)',
                    border: `1px solid ${s.required ? 'rgba(13,148,136,0.35)' : 'var(--border)'}`,
                    color: s.required ? 'var(--brand)' : 'var(--text-muted)' }}>
                    {s.title}{s.required ? ' *' : ''}
                  </span>
                  <label style={{ display:'flex', alignItems:'center', gap:4, fontSize:11,
                    color:'var(--text-muted)' }}>
                    <span style={{ fontSize:10 }}>📅</span>
                    <input
                      type="date"
                      value={s.due_date ?? ''}
                      onChange={e => setCompSubtasks(prev =>
                        prev.map((sub, idx) => idx === i ? { ...sub, due_date: e.target.value || undefined } : sub)
                      )}
                      placeholder={dueDate || 'same as task'}
                      style={{ fontSize:11, border:'1px solid var(--border)', borderRadius:6,
                        padding:'2px 6px', background:'var(--surface)', color:'var(--text-secondary)',
                        outline:'none', colorScheme:'light dark', fontFamily:'inherit' }}
                    />
                  </label>
                </div>
              ))}
            </div>
            <p style={{ fontSize:10, color:'var(--text-muted)', marginTop:6 }}>
              * mandatory · Leave date blank to use parent task date · File must be named as shown
            </p>
          </div>
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
